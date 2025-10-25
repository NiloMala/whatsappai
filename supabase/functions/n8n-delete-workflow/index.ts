import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { workflowId, n8nUrl, n8nApiKey } = await req.json();

    console.log('🗑️ ========================================');
    console.log('🗑️ DELETANDO WORKFLOW NO N8N');
    console.log('🗑️ Workflow ID:', workflowId);
    console.log('🗑️ N8N URL:', n8nUrl);
    console.log('🗑️ API Key presente:', !!n8nApiKey);
    console.log('🗑️ ========================================');

    if (!workflowId) {
      throw new Error('workflowId é obrigatório');
    }

    if (!n8nUrl || !n8nApiKey) {
      throw new Error('n8nUrl e n8nApiKey são obrigatórios');
    }

    // PASSO 1: Primeiro, desativar o workflow (se estiver ativo)
    console.log('📴 Desativando workflow...');
    const deactivateResponse = await fetch(`${n8nUrl}/api/v1/workflows/${workflowId}`, {
      method: 'PATCH',
      headers: {
        'X-N8N-API-KEY': n8nApiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ active: false }),
    });

    if (!deactivateResponse.ok && deactivateResponse.status !== 404) {
      const errorText = await deactivateResponse.text();
      console.warn('⚠️ Erro ao desativar workflow (continuando mesmo assim):', errorText);
    } else if (deactivateResponse.ok) {
      console.log('✅ Workflow desativado');
    }

    // PASSO 2: Arquivar o workflow (mudando tags para "Archived")
    console.log('📦 Arquivando workflow...');
    const archiveResponse = await fetch(`${n8nUrl}/api/v1/workflows/${workflowId}`, {
      method: 'PATCH',
      headers: {
        'X-N8N-API-KEY': n8nApiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ 
        tags: [{ name: 'Archived' }]
      }),
    });

    if (!archiveResponse.ok && archiveResponse.status !== 404) {
      const errorText = await archiveResponse.text();
      console.warn('⚠️ Erro ao arquivar workflow (tentando deletar mesmo assim):', errorText);
    } else if (archiveResponse.ok) {
      console.log('✅ Workflow arquivado');
    }

    // PASSO 3: Agora sim, deletar o workflow
    console.log('🗑️ Deletando workflow arquivado...');
    const deleteResponse = await fetch(`${n8nUrl}/api/v1/workflows/${workflowId}`, {
      method: 'DELETE',
      headers: {
        'X-N8N-API-KEY': n8nApiKey,
        'Accept': 'application/json',
      },
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error('❌ Erro ao deletar workflow:', {
        status: deleteResponse.status,
        statusText: deleteResponse.statusText,
        error: errorText
      });
      
      // Se o workflow não existir (404), considerar sucesso
      if (deleteResponse.status === 404) {
        console.log('⚠️ Workflow não encontrado no n8n (já foi deletado?)');
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Workflow não encontrado (possivelmente já deletado)' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Erro ao deletar workflow: ${deleteResponse.status} ${errorText}`);
    }

    console.log('✅ Workflow deletado com sucesso do n8n');

    return new Response(
      JSON.stringify({ 
        success: true,
        workflowId,
        message: 'Workflow deletado com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na função n8n-delete-workflow:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
