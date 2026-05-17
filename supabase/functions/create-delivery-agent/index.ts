import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateDeliveryAgentRequest {
  miniSiteId: string;
  miniSiteName: string;
  whatsappNumber: string;
  userId: string;
  instanceName: string;
  workflow: any; // Workflow já gerado pelo frontend
  webhookUrl: string; // Webhook URL do workflow
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { miniSiteId, miniSiteName, whatsappNumber, userId, instanceName, workflow, webhookUrl }: CreateDeliveryAgentRequest = await req.json();

    console.log('📦 Criando agente de delivery:', { miniSiteId, miniSiteName, whatsappNumber, userId, instanceName });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar instance_key da tabela whatsapp_connections
    const { data: whatsappConnection, error: connectionError } = await supabase
      .from('whatsapp_connections')
      .select('instance_key, phone_number')
      .eq('user_id', userId)
      .eq('status', 'connected')
      .single();

    if (connectionError || !whatsappConnection) {
      throw new Error('Nenhuma instância do WhatsApp conectada encontrada. Conecte o WhatsApp primeiro.');
    }

    const instanceKey = whatsappConnection.instance_key;
    console.log('📱 Instance Key encontrada:', instanceKey);

    // 1. Criar o agente no banco
    const agentName = `Delivery - ${miniSiteName}`;
    const deliveryPrompt = `Você é o assistente virtual de delivery do ${miniSiteName}.
        
Sua função é gerenciar pedidos:
- Confirmar recebimento de novos pedidos
- Informar status de preparação
- Avisar sobre saída para entrega  
- Confirmar entregas
- Responder dúvidas sobre pedidos

Seja sempre cordial e use emojis para deixar a conversa amigável! 😊`;

    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .insert({
        name: agentName,
        user_id: userId,
        instance_name: instanceKey, // Usar instance_key ao invés do número
        prompt: deliveryPrompt,
        system_prompt: deliveryPrompt,
        ai_model: 'openai',
        agent_type: 'delivery',
        webhook_url: webhookUrl
      })
      .select()
      .single();

    if (agentError) {
      console.error('❌ Erro ao criar agente:', agentError);
      throw agentError;
    }

    console.log('✅ Agente criado:', agent.id);

    // 2. Importar workflow no n8n
    const n8nUrl = Deno.env.get('N8N_URL') || 'https://n8n.auroratech.online';
    const n8nApiKey = Deno.env.get('N8N_API_KEY');
    
    if (!n8nApiKey) {
      throw new Error('N8N_API_KEY não configurada');
    }

    // Chamar a função de importação de workflow
    const { data: workflowData, error: workflowError } = await supabase.functions.invoke('n8n-import-workflow', {
      body: {
        workflow,
        workflowName: agentName,
        n8nUrl,
        n8nApiKey,
        instanceName
      }
    });

    if (workflowError) {
      console.error('❌ Erro ao criar workflow:', workflowError);
      // Não falhar se o workflow não for criado, apenas logar
      console.warn('⚠️ Agente criado mas sem workflow ativo');
    } else {
      console.log('✅ Workflow criado:', workflowData?.workflowId);
      
      // Extrair webhook URL do workflow criado
      const n8nUrl = Deno.env.get('N8N_URL') || 'https://n8n.auroratech.online';
      const webhookPath = workflow.nodes.find((n: any) => n.type === 'n8n-nodes-base.webhook')?.parameters?.path;
      const fullWebhookUrl = webhookPath ? `${n8nUrl}/webhook/${webhookPath}` : webhookUrl;
      
      console.log('🔗 Webhook URL:', fullWebhookUrl);
      
      // 3. Atualizar agente com workflow_id e webhook_url
      const { error: updateError } = await supabase
        .from('agents')
        .update({
          workflow_id: workflowData?.workflowId,
          webhook_url: fullWebhookUrl
        })
        .eq('id', agent.id);

      if (updateError) {
        console.error('⚠️ Erro ao atualizar agente com workflow:', updateError);
      }

      // 4. Configurar webhook usando a Edge Function configure-webhook
      try {
        console.log('📡 Configurando webhook via Edge Function...');
        
        // Obter token de autenticação do request
        const authHeader = req.headers.get('authorization');
        
        const { data: webhookConfigData, error: webhookConfigError } = await supabase.functions.invoke('configure-webhook', {
          body: {
            instanceName: instanceKey,
            webhookUrl: fullWebhookUrl
          },
          headers: authHeader ? {
            Authorization: authHeader
          } : undefined
        });

        if (webhookConfigError) {
          console.error('⚠️ Erro ao configurar webhook:', webhookConfigError);
        } else {
          console.log('✅ Webhook configurado com sucesso:', webhookConfigData);
        }
      } catch (webhookError) {
        console.error('❌ Erro ao chamar configure-webhook:', webhookError);
      }
    }

    // 6. Vincular agente ao mini site
    const { error: linkError } = await supabase
      .from('mini_sites')
      .update({ agent_id: agent.id })
      .eq('id', miniSiteId);

    if (linkError) {
      console.error('⚠️ Erro ao vincular agente ao mini site:', linkError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        agent_id: agent.id,
        workflow_id: workflowData?.workflowId,
        message: 'Agente de delivery criado com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
