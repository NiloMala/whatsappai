import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

// Stripe webhook receiver for Supabase Edge Function (Deno)
// Expects env vars:
// - STRIPE_WEBHOOK_SECRET
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY

function hexEncode(buffer: Uint8Array) {
  return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
}

function safeCompare(a: string, b: string) {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) {
    res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return res === 0;
}

serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    const payload = await req.text();
    const sig = req.headers.get('stripe-signature') || '';
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

    if (!webhookSecret) {
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), { status: 500 });
    }

    // Parse stripe-signature header: t=...,v1=...,v0=...
    // Build a map from the signature header
    const parts = sig.split(',');
    const sigMap: Record<string,string> = {};
    for (const part of parts) {
      const [k, v] = part.split('=');
      if (k && v) sigMap[k.trim()] = v.trim();
    }

    const t = sigMap['t'];
    const v1 = sigMap['v1'];
    if (!t || !v1) {
      return new Response(JSON.stringify({ error: 'Invalid signature header' }), { status: 400 });
    }

    // verify signature: expected = HMAC_SHA256(webhookSecret, `${t}.${payload}`)
    const encoder = new TextEncoder();
    const keyData = encoder.encode(webhookSecret);
    const msg = encoder.encode(`${t}.${payload}`);
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, msg) as ArrayBuffer;
    const expected = hexEncode(new Uint8Array(sigBuf));

    if (!safeCompare(expected, v1)) {
      return new Response(JSON.stringify({ error: 'Signature verification failed' }), { status: 400 });
    }

    // Parse JSON payload now
    const event = JSON.parse(payload);

    // Main event dispatcher
    const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  // Debug: log presence (do NOT log the secret value in production)
  console.log('stripe-webhook: serviceRole present=', !!serviceRole, 'length=', serviceRole ? serviceRole.length : 0);
    if (!supabaseUrl || !serviceRole) {
      console.error('Supabase URL or service role missing');
      return new Response(JSON.stringify({ error: 'Supabase not configured' }), { status: 500 });
    }

    const headers = {
      'apikey': serviceRole,
      'Authorization': `Bearer ${serviceRole}`,
      'Content-Type': 'application/json'
    };

    // helper: find user_plan by subscription_id or by user_id
    async function findPlanBySubscription(subscriptionId: string) {
      const url = `${supabaseUrl}/rest/v1/user_plans?subscription_id=eq.${subscriptionId}&select=*&limit=1`;
      const res = await fetch(url, { method: 'GET', headers });
      if (!res.ok) return null;
      const json = await res.json();
      return Array.isArray(json) && json.length > 0 ? json[0] : null;
    }

    async function upsertPlanForUser(userId: string | null, opts: any) {
      // Try to find existing active/trial row for user first
      if (userId) {
        const sel = `${supabaseUrl}/rest/v1/user_plans?user_id=eq.${userId}&select=*&limit=1`;
        const selRes = await fetch(sel, { method: 'GET', headers });
        if (selRes.ok) {
          const rows = await selRes.json();
          if (Array.isArray(rows) && rows.length > 0) {
            const id = rows[0].id;
            const patchUrl = `${supabaseUrl}/rest/v1/user_plans?id=eq.${id}`;
            const body = { ...opts, updated_at: new Date().toISOString() };
            await fetch(patchUrl, { method: 'PATCH', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify(body) });
            return;
          }
        }
      }

      // fallback: insert new
      const insertUrl = `${supabaseUrl}/rest/v1/user_plans`;
      const insertBody = { ...(userId ? { user_id: userId } : {}), ...opts, created_at: new Date().toISOString() };
      await fetch(insertUrl, { method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify(insertBody) });
    }

    // Helper to map stripe subscription status to our status
    function mapStripeStatus(status: string) {
      switch (status) {
        case 'active': return 'active';
        case 'past_due': return 'past_due';
        case 'unpaid': return 'past_due';
        case 'canceled': return 'canceled';
        case 'incomplete': return 'trial';
        default: return status;
      }
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const userId = session.client_reference_id || session.metadata?.user_id || null;
          const planType = session.metadata?.plan_type || null;
          const subscriptionId = session.subscription || null;
          await upsertPlanForUser(userId, { status: 'active', plan_type: planType || 'basic', subscription_id: subscriptionId, trial_expires_at: null });
          break;
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          const subscriptionId = subscription.id;
          const status = mapStripeStatus(subscription.status);
          const userId = subscription.metadata?.user_id || null;
          const currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
          const canceledAt = subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null;
          // try to find by subscription_id
          const plan = await findPlanBySubscription(subscriptionId);
          if (plan) {
            const patchUrl = `${supabaseUrl}/rest/v1/user_plans?id=eq.${plan.id}`;
            const body = { status, subscription_id: subscriptionId, expires_at: currentPeriodEnd, canceled_at: canceledAt, updated_at: new Date().toISOString() } as any;
            await fetch(patchUrl, { method: 'PATCH', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify(body) });
          } else {
            await upsertPlanForUser(userId, { status, plan_type: subscription.metadata?.plan_type || 'basic', subscription_id: subscriptionId, expires_at: currentPeriodEnd, canceled_at: canceledAt });
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const subscriptionId = invoice.subscription;
          if (!subscriptionId) break;
          const plan = await findPlanBySubscription(subscriptionId);
          if (plan) {
            const patchUrl = `${supabaseUrl}/rest/v1/user_plans?id=eq.${plan.id}`;
            const body = { status: 'past_due', updated_at: new Date().toISOString() } as any;
            await fetch(patchUrl, { method: 'PATCH', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify(body) });
          }
          break;
        }

        case 'invoice.paid':
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          const subscriptionId = invoice.subscription;
          if (!subscriptionId) break;
          // try to get period end from invoice
          const periodEnd = invoice.lines?.data?.[0]?.period?.end ? new Date(invoice.lines.data[0].period.end * 1000).toISOString() : null;
          const plan = await findPlanBySubscription(subscriptionId);
          if (plan) {
            const patchUrl = `${supabaseUrl}/rest/v1/user_plans?id=eq.${plan.id}`;
            const body = { status: 'active', expires_at: periodEnd, updated_at: new Date().toISOString() } as any;
            await fetch(patchUrl, { method: 'PATCH', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify(body) });
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const subscriptionId = subscription.id;
          const canceledAt = subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : new Date().toISOString();
          const plan = await findPlanBySubscription(subscriptionId);
          if (plan) {
            const patchUrl = `${supabaseUrl}/rest/v1/user_plans?id=eq.${plan.id}`;
            const body = { status: 'canceled', canceled_at: canceledAt, expires_at: canceledAt, updated_at: new Date().toISOString() } as any;
            await fetch(patchUrl, { method: 'PATCH', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify(body) });
          }
          break;
        }

        default:
          // ignore other events
          break;
      }
    } catch (e) {
      console.error('Processing error:', String(e));
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
