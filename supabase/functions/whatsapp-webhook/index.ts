import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

    // Salvar mensagem recebida no Supabase para atualização em tempo real
    try {
      console.log('🔍 Verificando se deve salvar no Supabase...');
      console.log('🔍 payload.event:', payload?.event);
      console.log('🔍 payload.data?.key?.fromMe:', payload?.data?.key?.fromMe);

      // Verificar se é uma mensagem recebida (não enviada)
      if (payload?.data?.key?.fromMe === false && payload?.event === 'messages.upsert') {
        console.log('💾 Salvando mensagem recebida no Supabase...');

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Extrair informações da mensagem
        const messageData = payload.data;
        const remoteJid = messageData.key?.remoteJid;
        const messageText = messageData.message?.conversation ||
                           messageData.message?.extendedTextMessage?.text ||
                           '[Mídia]';

        // Extrair número do telefone (remover @s.whatsapp.net)
        const contactPhone = remoteJid?.replace('@s.whatsapp.net', '');

        if (!contactPhone) {
          console.log('⚠️ Não foi possível extrair número do telefone');
        } else {
          console.log('📱 Mensagem de:', contactPhone);
          console.log('💬 Conteúdo:', messageText);
          console.log('🔑 Webhook UUID:', webhookPath);

          // Buscar user_id e instance_id na tabela webhooks usando o UUID
          const { data: webhook, error: webhookError } = await supabase
            .from('webhooks')
            .select('user_id, instance_id')
            .eq('url', `https://cvyagrunpypnznptkcsf.supabase.co/functions/v1/whatsapp-webhook/${webhookPath}`)
            .single();

          if (webhookError || !webhook) {
            console.log('⚠️ Webhook não encontrado para UUID:', webhookPath, webhookError);

            // Tentar buscar por LIKE caso a URL seja ligeiramente diferente
            const { data: webhookLike, error: webhookLikeError } = await supabase
              .from('webhooks')
              .select('user_id, instance_id')
              .ilike('url', `%${webhookPath}%`)
              .single();

            if (webhookLikeError || !webhookLike) {
              console.log('⚠️ Webhook não encontrado mesmo com LIKE:', webhookLikeError);
            } else {
              console.log('✅ Webhook encontrado com LIKE!', webhookLike);
              // Usar webhookLike se encontrou
              const connection = { user_id: webhookLike.user_id, instance_key: webhookLike.instance_id };
              await processMessage(connection);
            }
          } else {
            console.log('✅ Webhook encontrado:', webhook);
            console.log('✅ User ID:', webhook.user_id);
            console.log('✅ Instance ID:', webhook.instance_id);

            // Criar objeto connection compatível
            const connection = { user_id: webhook.user_id, instance_key: webhook.instance_id };
            await processMessage(connection);
          }

          // Função auxiliar para processar a mensagem
          async function processMessage(connection: { user_id: string; instance_key: string }) {
            console.log('✅ User ID encontrado:', connection.user_id);

            // VALIDAR LIMITE DE MENSAGENS
            console.log('🔒 Verificando limite de mensagens para user_id:', connection.user_id);
            try {
              const { data: limitCheck, error: limitError } = await supabase.functions.invoke('check-message-limit', {
                body: { user_id: connection.user_id, increment: true }
              });

              if (limitError) {
                console.error('❌ Erro ao verificar limite:', limitError);
              } else if (limitCheck && !limitCheck.allowed) {
                console.log('⚠️ Limite de mensagens atingido!', limitCheck);
                console.log(`📊 Usado: ${limitCheck.messages_used}/${limitCheck.messages_limit}`);
                // Não processar a mensagem, apenas logar
                console.log('🚫 Mensagem não será processada devido ao limite');
                return; // Não processar mais nada
              } else {
                console.log('✅ Limite OK!', limitCheck);
                console.log(`📊 Usado: ${limitCheck.messages_used}/${limitCheck.messages_limit} (${limitCheck.remaining} restantes)`);
              }
            } catch (err) {
              console.error('❌ Erro inesperado ao verificar limite:', err);
              // Continuar mesmo com erro na verificação
            }

            // Buscar ou criar conversa
            const { data: conversation, error: convError } = await supabase
              .rpc('upsert_conversation', {
                p_user_id: connection.user_id,
                p_contact_phone: contactPhone,
                p_contact_name: messageData.pushName || contactPhone,
                p_last_message: messageText.substring(0, 500),
                p_last_message_at: new Date().toISOString()
              });

            if (convError) {
              console.error('❌ Erro ao criar/buscar conversa:', convError);
            } else {
              console.log('✅ Conversa ID:', conversation);

              // Salvar mensagem
              const { error: msgError } = await supabase
                .from('messages')
                .insert({
                  conversation_id: conversation,
                  user_id: connection.user_id,
                  content: messageText,
                  sender_type: 'customer',
                  is_ai_generated: false,
                  status: 'received'
                });

              if (msgError) {
                console.error('❌ Erro ao salvar mensagem:', msgError);
              } else {
                console.log('✅ Mensagem salva no Supabase com sucesso!');
              }
            }
          }
        }
      }
    } catch (supabaseError) {
      console.error('❌ Erro ao salvar no Supabase:', supabaseError);
      // Não falhar o webhook por isso
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

