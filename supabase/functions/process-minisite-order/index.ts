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
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const orderData: OrderData = await req.json();
    console.log('📦 Pedido recebido:', orderData);

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

    // Buscar dados do agente e workflow
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name, workflow_id')
      .eq('id', miniSite.agent_id)
      .single();

    if (agentError || !agent || !agent.workflow_id) {
      console.error('❌ Agente ou workflow não encontrado:', agentError);
      return new Response(
        JSON.stringify({
          success: true,
          directWhatsApp: true,
          message: 'Agente não configurado corretamente'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Gerar número de pedido único
    const orderNumber = Math.floor(Math.random() * 90000000) + 10000000;

    // Formatar mensagem do pedido para o agente processar
    const orderMessage = formatOrderMessage(orderData, orderNumber, miniSite.name);

    console.log('📨 Enviando pedido para agente:', agent.name);
    console.log('📝 Mensagem:', orderMessage);

    // Construir payload simulando mensagem do WhatsApp
    const webhookPayload = {
      event: 'messages.upsert',
      instance: miniSite.whatsapp_number,
      data: {
        key: {
          remoteJid: `${orderData.customerPhone}@s.whatsapp.net`,
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

    // Enviar para webhook do workflow n8n
    const webhookUrl = `https://webhook.auroratech.tech/webhook/${agent.workflow_id}`;

    console.log('🔗 Enviando para webhook:', webhookUrl);

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    const webhookResponseText = await webhookResponse.text();
    console.log('📨 Resposta do webhook:', webhookResponse.status, webhookResponseText);

    if (!webhookResponse.ok) {
      console.error('❌ Erro ao enviar para webhook');
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
