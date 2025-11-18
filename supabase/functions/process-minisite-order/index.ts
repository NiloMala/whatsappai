import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderItem {
  title: string;
  quantity: number;
  price: number;
  selectedOptions?: Array<{ name: string; price: number }>;
}

interface OrderData {
  miniSiteSlug: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  paymentMethod: string;
  observations?: string;
  items: OrderItem[];
  total: number;
  orderId?: string; // UUID do pedido salvo no frontend
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const orderData: OrderData = await req.json();
    console.log('📦 Pedido recebido:', orderData);
    console.log('🆔 Order ID recebido:', orderData.orderId);

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar mini site e agent_id
    const { data: miniSite, error: miniSiteError } = await supabase
      .from('mini_sites')
      .select('id, name, user_id, agent_id, whatsapp_number')
      .eq('slug', orderData.miniSiteSlug)
      .single();

    if (miniSiteError || !miniSite) {
      console.error('❌ Mini site não encontrado:', miniSiteError);
      return new Response(
        JSON.stringify({ error: 'Mini site não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Se não houver agente configurado, retornar indicação para envio direto
    if (!miniSite.agent_id) {
      console.log('ℹ️ Nenhum agente configurado, enviar diretamente ao WhatsApp');
      return new Response(
        JSON.stringify({
          success: true,
          directWhatsApp: true,
          message: 'Nenhum agente configurado'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Buscar dados do agente e webhook
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name, workflow_id, webhook_url')
      .eq('id', miniSite.agent_id)
      .single();

    if (agentError || !agent) {
      console.error('❌ Agente não encontrado:', agentError);
      console.error('📊 Debug agent data:', { agent, agentError });
      return new Response(
        JSON.stringify({
          success: true,
          directWhatsApp: true,
          message: 'Agente não configurado corretamente'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Validar se webhook_url ou workflow_id existe
    if (!agent.webhook_url && !agent.workflow_id) {
      console.warn('⚠️ Nenhum webhook configurado no agente');
      return new Response(
        JSON.stringify({
          success: true,
          directWhatsApp: true,
          message: 'Webhook não configurado no agente'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('✅ Agente encontrado:', {
      id: agent.id,
      name: agent.name,
      webhook_url: agent.webhook_url,
      workflow_id: agent.workflow_id
    });

    // Gerar número de pedido único
    const orderNumber = Math.floor(Math.random() * 90000000) + 10000000;
    console.log('🔢 Order Number gerado:', orderNumber);

    // Se o frontend enviou orderId, atualizar o registro com o order_number
    if (orderData.orderId) {
      console.log('💾 Tentando atualizar order_number no banco...');
      console.log('   - orderId:', orderData.orderId);
      console.log('   - orderNumber:', orderNumber);
      
      const { error: updateError } = await supabase
        .from('minisite_orders')
        .update({ order_number: orderNumber })
        .eq('id', orderData.orderId);

      if (updateError) {
        console.error('⚠️ Erro ao atualizar order_number:', updateError);
        console.error('   - Error code:', updateError.code);
        console.error('   - Error message:', updateError.message);
        console.error('   - Error details:', updateError.details);
        // Não bloquear o fluxo, apenas registrar o erro
      } else {
        console.log('✅ Order number salvo com sucesso:', orderNumber, 'para pedido:', orderData.orderId);
      }
    } else {
      console.warn('⚠️ Nenhum orderId fornecido, order_number não será salvo no banco');
    }

    // Formatar mensagem do pedido para o agente processar
    const orderMessage = formatOrderMessage(orderData, orderNumber, miniSite.name);

    console.log('📨 Enviando pedido para agente:', agent.name);
    console.log('📝 Mensagem:', orderMessage);

    // Formatar número do WhatsApp (adicionar código do país se não tiver)
    let formattedPhone = orderData.customerPhone.replace(/\D/g, ''); // Remove caracteres não numéricos
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone; // Adiciona código do país Brasil
    }
    console.log('📞 Telefone formatado:', formattedPhone);

    // Construir payload simulando mensagem do WhatsApp
    const webhookPayload = {
      event: 'messages.upsert',
      instance: miniSite.whatsapp_number,
      data: {
        key: {
          remoteJid: `${formattedPhone}@s.whatsapp.net`,
          fromMe: false,
          id: `ORDER_${orderNumber}_${Date.now()}`
        },
        message: {
          conversation: orderMessage
        },
        pushName: orderData.customerName,
        messageType: 'conversation'
      }
    };

    // Construir URL do webhook: usar webhook_url se existir, senão construir a partir de workflow_id
    const webhookUrl = agent.webhook_url || `https://webhook.auroratech.tech/webhook/${agent.workflow_id}`;

    console.log('🔗 Enviando para webhook:', webhookUrl);
    console.log('📦 Payload:', JSON.stringify(webhookPayload, null, 2));

    try {
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      const webhookResponseText = await webhookResponse.text();
      console.log('📨 Resposta do webhook - Status:', webhookResponse.status);
      console.log('📨 Resposta do webhook - Headers:', JSON.stringify(Object.fromEntries(webhookResponse.headers.entries())));
      console.log('📨 Resposta do webhook - Body:', webhookResponseText);

      if (!webhookResponse.ok) {
        console.error('❌ Erro ao enviar para webhook - Status não OK:', webhookResponse.status);
        console.error('❌ Response body:', webhookResponseText);
        return new Response(
          JSON.stringify({
            success: true,
            directWhatsApp: true,
            message: 'Erro ao processar com agente'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    } catch (fetchError) {
      console.error('❌ Erro na requisição ao webhook:', fetchError);
      console.error('❌ Erro detalhado:', fetchError.message, fetchError.stack);
      return new Response(
        JSON.stringify({
          success: true,
          directWhatsApp: true,
          message: 'Erro ao processar com agente'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        directWhatsApp: false,
        orderNumber,
        orderId: orderData.orderId,
        message: 'Pedido processado pelo agente IA'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function formatOrderMessage(orderData: OrderData, orderNumber: number, businessName: string): string {
  let message = `🛒 NOVO PEDIDO #${orderNumber}\n\n`;
  message += `📋 Dados do Cliente:\n`;
  message += `• Nome: ${orderData.customerName}\n`;
  message += `• Telefone: ${orderData.customerPhone}\n`;
  message += `• Endereço: ${orderData.customerAddress}\n\n`;

  message += `🍔 Itens do Pedido:\n`;
  orderData.items.forEach((item) => {
    message += `• ${item.quantity}x ${item.title}`;
    if (item.selectedOptions && item.selectedOptions.length > 0) {
      const options = item.selectedOptions.map(o => o.name).join(', ');
      message += ` (${options})`;
    }
    const itemTotal = (item.price + (item.selectedOptions?.reduce((s, o) => s + o.price, 0) || 0)) * item.quantity;
    message += ` - R$ ${itemTotal.toFixed(2)}\n`;
  });

  message += `\n💰 Total: R$ ${orderData.total.toFixed(2)}\n`;
  message += `💳 Forma de Pagamento: ${orderData.paymentMethod}\n`;

  if (orderData.observations) {
    message += `\n📝 Observações: ${orderData.observations}\n`;
  }

  message += `\n🏪 Estabelecimento: ${businessName}`;

  return message;
}
