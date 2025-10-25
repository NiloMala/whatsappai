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
    const { workflow, workflowName, n8nUrl, n8nApiKey, workflowId } = await req.json();

    console.log('🔧 Importando/Atualizando workflow no n8n:', workflowName);
    console.log('🆔 Workflow ID existente:', workflowId || 'Novo workflow');

    // Remover campos read-only que o n8n não aceita na criação
    const cleanWorkflow = {
      name: workflowName,
      nodes: workflow.nodes || [],
      connections: workflow.connections || {},
      settings: workflow.settings || {
        executionOrder: 'v1',
      },
      staticData: workflow.staticData || null,
      // NÃO incluir: active, id, versionId, meta, tags, createdAt, updatedAt
    };

    console.log('📦 Workflow limpo:', JSON.stringify(cleanWorkflow, null, 2));

    let workflowResult;
    let isUpdate = false;

    // Se tiver workflowId, atualizar; senão, criar novo
    if (workflowId) {
      console.log('🔄 Atualizando workflow existente:', workflowId);
      isUpdate = true;
      
      const updateWorkflowResponse = await fetch(`${n8nUrl}/api/v1/workflows/${workflowId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': n8nApiKey,
        },
        body: JSON.stringify(cleanWorkflow),
      });

      if (!updateWorkflowResponse.ok) {
        const errorText = await updateWorkflowResponse.text();
        console.error('❌ Erro ao atualizar workflow:', errorText);
        throw new Error(`Atualizar workflow falhou: ${updateWorkflowResponse.status} - ${errorText}`);
      }

      workflowResult = await updateWorkflowResponse.json();
      console.log('✅ Workflow atualizado no n8n:', workflowResult.id);
    } else {
      console.log('➕ Criando novo workflow');
      
      const createWorkflowResponse = await fetch(`${n8nUrl}/api/v1/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': n8nApiKey,
        },
        body: JSON.stringify(cleanWorkflow),
      });

      if (!createWorkflowResponse.ok) {
        const errorText = await createWorkflowResponse.text();
        console.error('❌ Erro ao criar workflow:', errorText);
        throw new Error(`Criar workflow falhou: ${createWorkflowResponse.status} - ${errorText}`);
      }

      workflowResult = await createWorkflowResponse.json();
      console.log('✅ Workflow criado no n8n:', workflowResult.id);
    }

    const createdWorkflow = workflowResult;

    // Ativar o workflow usando endpoint específico
    console.log('🔄 Ativando workflow:', createdWorkflow.id);
    
    // Tentar endpoint /activate
    const activateResponse = await fetch(`${n8nUrl}/api/v1/workflows/${createdWorkflow.id}/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': n8nApiKey,
      },
    });

    console.log('📊 Status da ativação:', activateResponse.status);

    if (!activateResponse.ok) {
      const errorText = await activateResponse.text();
      console.error('⚠️ Aviso ao ativar workflow:', activateResponse.status, errorText);
      // Não falha se não conseguir ativar, pois o workflow foi criado
    } else {
      const activateResult = await activateResponse.json();
      console.log('✅ Workflow ativado com sucesso:', activateResult);
    }

    // Retornar informações do workflow criado/atualizado
    return new Response(
      JSON.stringify({
        success: true,
        workflowId: createdWorkflow.id,
        workflowUrl: `${n8nUrl}/workflow/${createdWorkflow.id}`,
        message: isUpdate ? 'Workflow atualizado e ativado com sucesso' : 'Workflow importado e ativado com sucesso',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Erro ao importar workflow:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
