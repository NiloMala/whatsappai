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
    const env = Deno.env;
    const EVOLUTION_URL = env.get("EVOLUTION_API_URL") || env.get("VITE_EVOLUTION_URL") || "https://evo.auroratech.tech";
    const EVOLUTION_API_KEY = env.get("EVOLUTION_API_KEY") || env.get("VITE_EVOLUTION_API_KEY");

    if (!EVOLUTION_API_KEY) {
      return new Response(JSON.stringify({ error: 'Server not configured: EVOLUTION_API_KEY missing' }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Expect body like: { method: 'POST', endpoint: '/chat/whatsappNumbers/{instance}', body: {...} }
    const payload = await req.json().catch(() => null);
    if (!payload || !payload.endpoint) {
      return new Response(JSON.stringify({ error: 'Invalid request, missing endpoint' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const method = (payload.method || 'POST').toUpperCase();
    const endpoint = payload.endpoint.startsWith('/') ? payload.endpoint : `/${payload.endpoint}`;
    const targetUrl = `${EVOLUTION_URL}${endpoint}`;

    const headers: Record<string,string> = {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
    };

    // Forward request
    const res = await fetch(targetUrl, {
      method,
      headers,
      body: payload.body ? JSON.stringify(payload.body) : undefined,
    });

    const text = await res.text();

    const responseHeaders = new Headers(corsHeaders);
    responseHeaders.set('content-type', 'application/json');

    return new Response(text, { status: res.status, headers: responseHeaders });
  } catch (err) {
    console.error('evolution-chat-proxy error', err);
    return new Response(JSON.stringify({ error: String(err) }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
