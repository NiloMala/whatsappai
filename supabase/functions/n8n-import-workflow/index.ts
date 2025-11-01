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
    const requestBody = await req.json();
    const { workflow, workflowName, n8nUrl, n8nApiKey, workflowId, instanceName } = requestBody;

    console.log('🔧 Importando workflow:', workflowName);
    console.log('📦 Workflow nodes:', workflow?.nodes?.length || 0);
    console.log('🔗 Workflow connections:', Object.keys(workflow?.connections || {}).length);
    console.log('🔑 N8N URL:', n8nUrl);
    console.log('🔐 N8N API Key presente:', !!n8nApiKey);
    console.log('🆔 Workflow ID para update:', workflowId || 'novo workflow');
    console.log('📱 Instance Name:', instanceName);

    if (!workflow || !workflow.nodes) {
      console.error('❌ Workflow inválido - nodes ausentes');
      throw new Error('Workflow inválido: nodes não encontrados');
    }

    if (!n8nApiKey) {
      console.error('❌ N8N API Key ausente');
      throw new Error('N8N API Key não fornecida');
    }

    if (!n8nUrl) {
      console.error('❌ N8N URL ausente');
      throw new Error('N8N URL não fornecida');
    }

    // Atualizar instanceName nos nós Evolution API
    if (instanceName && workflow.nodes) {
      let updatedCount = 0;
      workflow.nodes.forEach((node: any) => {
        if (node.type === 'n8n-nodes-evolution-api.evolutionApi' && node.parameters) {
          node.parameters.instanceName = instanceName;
          updatedCount++;
        }
      });
      console.log('📝 Nós Evolution API atualizados:', updatedCount);
    }

    // Remover campos read-only que o n8n não aceita na criação
    const cleanWorkflow = {
      name: workflowName,
      nodes: workflow.nodes || [],
      connections: workflow.connections || {},
      settings: {
        executionOrder: workflow.settings?.executionOrder || 'v1',
      },
      staticData: workflow.staticData || null,
    };

    let workflowResult;
    let isUpdate = false;

    // Se tiver workflowId, atualizar; senão, criar novo
    if (workflowId) {
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
        throw new Error(`Atualizar workflow falhou: ${updateWorkflowResponse.status} - ${errorText}`);
      }

      workflowResult = await updateWorkflowResponse.json();
    } else {
      console.log('📤 Enviando workflow para n8n...');
      console.log('🔗 URL:', `${n8nUrl}/api/v1/workflows`);
      console.log('📋 Workflow name:', cleanWorkflow.name);
      console.log('📊 Nodes count:', cleanWorkflow.nodes.length);

      const createWorkflowResponse = await fetch(`${n8nUrl}/api/v1/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': n8nApiKey,
        },
        body: JSON.stringify(cleanWorkflow),
      });

      console.log('📥 Resposta do n8n:', createWorkflowResponse.status, createWorkflowResponse.statusText);

      if (!createWorkflowResponse.ok) {
        const errorText = await createWorkflowResponse.text();
        console.error('❌ Erro ao criar workflow no n8n:');
        console.error('  Status:', createWorkflowResponse.status);
        console.error('  Response:', errorText);

        // Tentar parsear como JSON para obter mais detalhes
        try {
          const errorJson = JSON.parse(errorText);
          console.error('  Error details:', JSON.stringify(errorJson, null, 2));
        } catch (e) {
          // Não é JSON, já logamos o texto
        }

        throw new Error(`Criar workflow falhou: ${createWorkflowResponse.status} - ${errorText}`);
      }

      workflowResult = await createWorkflowResponse.json();
      console.log('✅ Workflow criado com sucesso:', workflowResult.id);
    }

    const createdWorkflow = workflowResult;

    // Ativar o workflow
    const activateResponse = await fetch(`${n8nUrl}/api/v1/workflows/${createdWorkflow.id}/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': n8nApiKey,
      },
    });

    if (!activateResponse.ok) {
      const errorText = await activateResponse.text();
      console.warn('Aviso ao ativar workflow:', errorText);
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
    console.error('Stack trace:', (error as any)?.stack);

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as any)?.message || String(error) || 'Erro desconhecido',
        details: (error as any)?.stack || '',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
