import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const N8N_URL = 'https://n8n.auroratech.tech';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('📩 ========================================');
    console.log('📩 WEBHOOK RECEBIDO');
    console.log('📩 Método:', req.method);
    console.log('📩 URL:', req.url);
    console.log('📩 Headers:', Object.fromEntries(req.headers.entries()));
    
    // Tentar ler o corpo como texto primeiro
    const bodyText = await req.text();
    console.log('📩 Body (texto):', bodyText);
    
    let payload;
    try {
      payload = JSON.parse(bodyText);
      console.log('📩 Payload parseado:', JSON.stringify(payload, null, 2));
    } catch (parseError) {
      console.error('❌ Erro ao parsear JSON:', parseError);
      console.error('❌ Corpo recebido:', bodyText);
      
      // Retornar sucesso mesmo com erro para não bloquear Evolution API
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Webhook recebido mas payload inválido',
          error: 'Invalid JSON',
          received: bodyText.substring(0, 100)
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Extrair o path do webhook da URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const webhookPath = pathParts[pathParts.length - 1];
    
    console.log('🔗 =====  DEBUG WEBHOOK PATH =====');
    console.log('🔗 Webhook Path extraído:', webhookPath);
    console.log('🔗 URL completa:', req.url);
    console.log('🔗 Pathname:', url.pathname);
    console.log('🔗 Path parts:', JSON.stringify(pathParts));
    console.log('🔗 =================================');

    // Formato correto do webhook n8n testado e validado
    const n8nWebhookUrl = `https://webhook.auroratech.tech/webhook/${webhookPath}`;
    
    console.log('🔄 ===== ENCAMINHAMENTO =====');
    console.log('🔄 URL do n8n:', n8nWebhookUrl);
    console.log('🔄 Payload:', JSON.stringify(payload, null, 2));
    console.log('🔄 ============================');

    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const n8nResponseText = await n8nResponse.text();
    console.log('📨 Status do n8n:', n8nResponse.status);
    console.log('📨 Resposta do n8n:', n8nResponseText);
    console.log('📩 ========================================');

    if (!n8nResponse.ok) {
      console.error('❌ Erro ao encaminhar para n8n:', n8nResponse.status, n8nResponseText);
      console.error('❌ URL tentada:', n8nWebhookUrl);
      // Não lançar erro, apenas logar
    } else {
      console.log('✅ Mensagem encaminhada com sucesso para n8n!');
    }

    // Retornar sucesso
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook recebido e encaminhado para n8n',
        webhookPath,
        n8nStatus: n8nResponse.status,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ ========================================');
    console.error('❌ ERRO NO WEBHOOK:', error);
    console.error('❌ ========================================');
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

