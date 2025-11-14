import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id, increment = false } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verificar status atual do limite
    const { data: statusData, error: statusError } = await supabase
      .rpc('check_and_reset_message_counter', { p_user_id: user_id });

    if (statusError) {
      console.error('Error checking message limit:', statusError);
      return new Response(
        JSON.stringify({ error: statusError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const status = statusData[0];

    // Se solicitou incremento e ainda tem limite disponível
    if (increment && !status.limit_reached) {
      const { data: incrementData, error: incrementError } = await supabase
        .rpc('increment_message_counter', { p_user_id: user_id });

      if (incrementError) {
        console.error('Error incrementing counter:', incrementError);
        return new Response(
          JSON.stringify({ error: incrementError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Retornar sucesso com status atualizado
      return new Response(
        JSON.stringify({
          allowed: incrementData,
          limit_reached: !incrementData,
          messages_used: status.messages_used + 1,
          messages_limit: status.messages_limit,
          remaining: Math.max(0, status.remaining - 1)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Apenas retornar status sem incrementar
    return new Response(
      JSON.stringify({
        allowed: !status.limit_reached,
        limit_reached: status.limit_reached,
        messages_used: status.messages_used,
        messages_limit: status.messages_limit,
        remaining: status.remaining
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
