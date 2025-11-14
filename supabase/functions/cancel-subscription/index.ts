import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

// Cancela uma assinatura no Stripe e atualiza a tabela user_plans
// Espera variáveis de ambiente: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

serve(async (req: Request) => {
  try {
    const origin = req.headers.get('origin') || '';
    const corsHeaders: Record<string,string> = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
      'Access-Control-Allow-Credentials': 'true'
    };

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

    let body: any;
    try { body = await req.json(); } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const userId = body.userId as string | undefined;
    const immediate = !!body.immediate;

    if (!userId) return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
    const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!STRIPE_KEY) return new Response(JSON.stringify({ error: 'Stripe key not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return new Response(JSON.stringify({ error: 'Supabase not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const headers = {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    };

    // Get active user_plan
    const selectUrl = `${SUPABASE_URL}/rest/v1/user_plans?user_id=eq.${userId}&status=eq.active&select=*&limit=1`;
    const getRes = await fetch(selectUrl, { method: 'GET', headers });
    if (!getRes.ok) {
      const txt = await getRes.text();
      return new Response(JSON.stringify({ error: 'Error fetching user plan', details: txt }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const existing = await getRes.json();
    if (!Array.isArray(existing) || existing.length === 0) {
      return new Response(JSON.stringify({ error: 'No active subscription found for user' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const planRow = existing[0];
    const subscriptionId = planRow.subscription_id as string | null;
    let expiresAt: string | null = null;

    if (!subscriptionId) {
      // No Stripe subscription linked — mark cancelled immediately
      const patchUrl = `${SUPABASE_URL}/rest/v1/user_plans?id=eq.${planRow.id}`;
      const bodyPatch = { status: 'canceled', expires_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      await fetch(patchUrl, { method: 'PATCH', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify(bodyPatch) });
      return new Response(JSON.stringify({ ok: true, message: 'Subscription canceled (no stripe id)' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // If we have a Stripe subscription id, either cancel at period end or immediately
    const stripeBase = 'https://api.stripe.com/v1';

    if (immediate) {
      // Cancel immediately
      const delRes = await fetch(`${stripeBase}/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${STRIPE_KEY}` }
      });
      const delData = await delRes.json();
      if (!delRes.ok) {
        return new Response(JSON.stringify({ error: 'Stripe cancel failed', details: delData }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      expiresAt = delData.canceled_at ? new Date(delData.canceled_at * 1000).toISOString() : new Date().toISOString();
    } else {
      // Set cancel_at_period_end = true
      const params = new URLSearchParams();
      params.append('cancel_at_period_end', 'true');
      const updRes = await fetch(`${stripeBase}/subscriptions/${subscriptionId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
      const updData = await updRes.json();
      if (!updRes.ok) {
        return new Response(JSON.stringify({ error: 'Stripe update failed', details: updData }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      expiresAt = updData.current_period_end ? new Date(updData.current_period_end * 1000).toISOString() : null;
    }

    // Update user_plans row
    const patchUrl = `${SUPABASE_URL}/rest/v1/user_plans?id=eq.${planRow.id}`;
    const bodyPatch = { status: 'canceled', expires_at: expiresAt, updated_at: new Date().toISOString() };
    const patchRes = await fetch(patchUrl, { method: 'PATCH', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify(bodyPatch) });
    if (!patchRes.ok) {
      const txt = await patchRes.text();
      return new Response(JSON.stringify({ error: 'Failed updating user_plan', details: txt }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ ok: true, expires_at: expiresAt }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (err) {
    console.error('cancel-subscription error', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
