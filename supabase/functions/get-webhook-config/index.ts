import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200
    });
  }

  try {
    console.log('🔍 ======================================');
    console.log('🔍 BUSCANDO CONFIGURAÇÃO DO WEBHOOK');
    
    const { instanceName } = await req.json();
    console.log('📥 Instance Name:', instanceName);

    if (!instanceName) {
      throw new Error('instanceName é obrigatório');
    }

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    console.log('🔑 Evolution URL:', evolutionApiUrl);
    console.log('🔑 API Key presente:', !!evolutionApiKey);

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Credenciais Evolution API não configuradas');
    }

    console.log('📤 Buscando em:', `${evolutionApiUrl}/webhook/find/${instanceName}`);
    
    const response = await fetch(`${evolutionApiUrl}/webhook/find/${instanceName}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
    });

    console.log('📊 Status da resposta:', response.status);
    const responseText = await response.text();
    console.log('📊 Resposta completa:', responseText);

    if (!response.ok) {
      console.error('❌ Erro da Evolution API:', responseText);
      throw new Error(`Evolution API retornou erro ${response.status}: ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
      console.log('✅ Configuração atual:', JSON.stringify(data, null, 2));
    } catch {
      data = { message: responseText };
    }

    console.log('🔍 ======================================');

    return new Response(
      JSON.stringify({ 
        success: true,
        instanceName,
        webhookConfig: data 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ ======================================');
    console.error('❌ ERRO AO BUSCAR CONFIG:', error);
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
