import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateDeliveryAgentRequest {
  miniSiteId: string;
  miniSiteName: string;
  userId: string;
  instanceName: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { miniSiteId, miniSiteName, userId, instanceName }: CreateDeliveryAgentRequest = await req.json();

    console.log('📦 Criando agente de delivery:', { miniSiteId, miniSiteName, userId, instanceName });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Criar o agente no banco
    const agentName = `Delivery - ${miniSiteName}`;
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .insert({
        name: agentName,
        user_id: userId,
        instance_name: instanceName,
        system_prompt: `Você é o assistente virtual de delivery do ${miniSiteName}.
        
Sua função é gerenciar pedidos:
- Confirmar recebimento de novos pedidos
- Informar status de preparação
- Avisar sobre saída para entrega  
- Confirmar entregas
- Responder dúvidas sobre pedidos

Seja sempre cordial e use emojis para deixar a conversa amigável! 😊`,
        ai_model: 'openai',
        agent_type: 'delivery' // Novo campo para identificar tipo de agente
      })
      .select()
      .single();

    if (agentError) {
      console.error('❌ Erro ao criar agente:', agentError);
      throw agentError;
    }

    console.log('✅ Agente criado:', agent.id);

    // 2. Gerar workflow de delivery via n8n
    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL') || 'https://webhook.auroratech.tech/webhook';
    
    // Chamar a função de importação de workflow
    const { data: workflowData, error: workflowError } = await supabase.functions.invoke('n8n-import-workflow', {
      body: {
        agentId: agent.id,
        userId: userId,
        miniSiteId: miniSiteId,
        miniSiteName: miniSiteName,
        instanceName: instanceName,
        workflowType: 'delivery' // Indica que é workflow de delivery
      }
    });

    if (workflowError) {
      console.error('❌ Erro ao criar workflow:', workflowError);
      // Não falhar se o workflow não for criado, apenas logar
      console.warn('⚠️ Agente criado mas sem workflow ativo');
    } else {
      console.log('✅ Workflow criado:', workflowData.workflow_id);
      
      // 3. Atualizar agente com workflow_id e webhook_url
      const { error: updateError } = await supabase
        .from('agents')
        .update({
          workflow_id: workflowData.workflow_id,
          webhook_url: workflowData.webhook_url
        })
        .eq('id', agent.id);

      if (updateError) {
        console.error('⚠️ Erro ao atualizar agente com workflow:', updateError);
      }
    }

    // 4. Vincular agente ao mini site
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
        workflow_id: workflowData?.workflow_id,
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
