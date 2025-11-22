import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { workflowId, updatedPrompt, agentName } = await req.json();

    // Ler credenciais das secrets do Supabase
    const n8nUrl = Deno.env.get('N8N_URL') || 'https://n8n.auroratech.tech';
    const n8nApiKey = Deno.env.get('N8N_API_KEY');

    console.log('🔄 Atualizando prompt do workflow:', workflowId);
    console.log('👤 Agente:', agentName);
    console.log('📝 Novo prompt length:', updatedPrompt?.length || 0);
    console.log('🔗 N8N URL:', n8nUrl);
    console.log('🔑 API Key presente:', !!n8nApiKey);

    if (!n8nApiKey) {
      throw new Error('N8N API Key não configurada. Configure a secret N8N_API_KEY no Supabase.');
    }

    if (!workflowId) {
      throw new Error('Workflow ID não fornecido');
    }

    if (!updatedPrompt) {
      throw new Error('Prompt atualizado não fornecido');
    }

    // Buscar workflow atual do n8n
    console.log('📥 Buscando workflow do n8n...');
    const getResponse = await fetch(`${n8nUrl}/api/v1/workflows/${workflowId}`, {
      headers: {
        'X-N8N-API-KEY': n8nApiKey,
      },
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      throw new Error(`Erro ao buscar workflow: ${getResponse.status} - ${errorText}`);
    }

    const workflow = await getResponse.json();
    console.log('✅ Workflow buscado');
    console.log('📦 Nodes:', workflow.nodes?.length || 0);

    // Encontrar e atualizar o nó AI Agent
    const aiAgentNode = workflow.nodes?.find((n: any) => n.name === 'AI Agent');

    if (!aiAgentNode) {
      throw new Error('Nó "AI Agent" não encontrado no workflow');
    }

    if (!aiAgentNode.parameters?.options) {
      aiAgentNode.parameters = { ...aiAgentNode.parameters, options: {} };
    }

    aiAgentNode.parameters.options.systemMessage = updatedPrompt;
    console.log('✅ Prompt atualizado no nó AI Agent');

    // Remover campos read-only que o n8n não aceita na atualização
    const cleanWorkflow = {
      name: workflow.name,
      nodes: workflow.nodes || [],
      connections: workflow.connections || {},
      settings: {
        executionOrder: workflow.settings?.executionOrder || 'v1',
      },
      staticData: workflow.staticData || null,
    };

    // Atualizar workflow no n8n
    console.log('💾 Salvando workflow atualizado...');
    const updateResponse = await fetch(`${n8nUrl}/api/v1/workflows/${workflowId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': n8nApiKey,
      },
      body: JSON.stringify(cleanWorkflow),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Erro ao atualizar workflow: ${updateResponse.status} - ${errorText}`);
    }

    const updatedWorkflow = await updateResponse.json();
    console.log('✅ Workflow atualizado com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Prompt do agente atualizado com sucesso',
        workflowId: updatedWorkflow.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Erro ao atualizar prompt:', error);
    console.error('Stack:', error?.stack);

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || String(error),
        details: error?.stack || '',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
