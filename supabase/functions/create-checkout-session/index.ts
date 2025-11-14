// Supabase Edge Function (Deno) to create a Stripe Checkout Session
// Expects environment variables:
// STRIPE_SECRET_KEY, STRIPE_PRICE_BASIC, STRIPE_PRICE_PRO, STRIPE_PRICE_BUSINESS
// FRONTEND_SUCCESS_URL, FRONTEND_CANCEL_URL

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

serve(async (req: Request) => {
  try {
    // CORS handling: allow OPTIONS preflight and add CORS headers to responses
    const origin = req.headers.get('origin') || '';
    const allowed = (Deno.env.get('FRONTEND_ALLOWED_ORIGINS') || '*').split(',').map(s => s.trim());
    const allowOrigin = allowed.includes('*') ? '*' : (allowed.includes(origin) ? origin : allowed[0] || '*');

    const corsHeaders: Record<string,string> = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      // include Supabase client headers and common custom headers used by browsers
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-client-info, apikey',
      'Access-Control-Allow-Credentials': 'true'
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body', details: String(e) }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    const planType = body.planType as string;
    const userId = body.userId as string | undefined;

    if (!planType) {
      return new Response(JSON.stringify({ error: 'planType is required' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
    const PRICE_BASIC = Deno.env.get('STRIPE_PRICE_BASIC') || '';
    const PRICE_PRO = Deno.env.get('STRIPE_PRICE_PRO') || '';
    const PRICE_BUSINESS = Deno.env.get('STRIPE_PRICE_BUSINESS') || '';
    const SUCCESS_URL = Deno.env.get('FRONTEND_SUCCESS_URL') || 'https://your-app-url/success';
    const CANCEL_URL = Deno.env.get('FRONTEND_CANCEL_URL') || 'https://your-app-url/cancel';

    if (!STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Stripe secret not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const priceMap: Record<string, string> = {
      basic: PRICE_BASIC,
      pro: PRICE_PRO,
      business: PRICE_BUSINESS,
    };

    const priceId = priceMap[planType];
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Price ID not configured for plan' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const form = new URLSearchParams();
    form.append('mode', 'subscription');
    form.append('line_items[0][price]', priceId);
    form.append('line_items[0][quantity]', '1');
    form.append('success_url', SUCCESS_URL + '?session_id={CHECKOUT_SESSION_ID}');
    form.append('cancel_url', CANCEL_URL);
  if (userId) form.append('client_reference_id', userId);
  // Add metadata so webhook can identify the plan and user
  if (planType) form.append('metadata[plan_type]', planType);
  if (userId) form.append('metadata[user_id]', userId);
    form.append('allow_promotion_codes', 'true');

    const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form.toString()
    });

    const data = await resp.json();
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: data }), { status: resp.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Return session URL to frontend
    return new Response(JSON.stringify({ sessionUrl: data.url, sessionId: data.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json', ...(typeof corsHeaders !== 'undefined' ? corsHeaders : {}) } });
  }
});
