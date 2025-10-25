import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      status: 200
    });
  }  try {
    console.log('🔵 ======================================');
    console.log('🔵 CONFIGURANDO WEBHOOK');
    const { instanceName, webhookUrl } = await req.json();
    console.log('📥 Instance Name:', instanceName);
    console.log('📥 Webhook URL:', webhookUrl);

    if (!instanceName || !webhookUrl) {
      throw new Error('instanceName e webhookUrl são obrigatórios');
    }

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    console.log('🔑 Evolution URL:', evolutionApiUrl);
    console.log('🔑 API Key presente:', !!evolutionApiKey);
    console.log('🔑 API Key primeiros 10 chars:', evolutionApiKey?.substring(0, 10));

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Credenciais Evolution API não configuradas no Supabase');
    }

    const webhookConfig = {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: false,
        events: [
          'MESSAGES_UPSERT'
        ]
      }
    };

    console.log('📤 Configuração do webhook:', JSON.stringify(webhookConfig, null, 2));
    console.log('📤 Enviando para:', `${evolutionApiUrl}/webhook/set/${instanceName}`);
    
    const response = await fetch(`${evolutionApiUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify(webhookConfig),
    });

    console.log('📊 Status da resposta Evolution:', response.status);
    const responseText = await response.text();
    console.log('📊 Resposta Evolution (texto):', responseText);

    if (!response.ok) {
      console.error('❌ Erro da Evolution API:', responseText);
      throw new Error(`Evolution API retornou erro ${response.status}: ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
      console.log('✅ Webhook configurado:', JSON.stringify(data, null, 2));
    } catch {
      data = { message: responseText };
      console.log('✅ Resposta (não-JSON):', responseText);
    }

    console.log('🔵 ======================================');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook configurado com sucesso',
        instanceName,
        webhookUrl,
        evolutionResponse: data 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ ======================================');
    console.error('❌ ERRO AO CONFIGURAR WEBHOOK:', error);
    console.error('❌ ======================================');
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
