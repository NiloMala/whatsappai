Deploy instructions for create-checkout-session Edge Function

1. Set environment variables in Supabase Functions dashboard:
   - STRIPE_SECRET_KEY: Your Stripe secret key
   - STRIPE_PRICE_BASIC: Price ID for basic
   - STRIPE_PRICE_PRO: Price ID for pro
   - STRIPE_PRICE_BUSINESS: Price ID for business
   - FRONTEND_SUCCESS_URL: https://your-app/success
   - FRONTEND_CANCEL_URL: https://your-app/cancel

2. Deploy the function via Supabase dashboard UI: create a new Function, paste `index.ts` content, save and deploy.

3. In the frontend, the path used is `/api/create-checkout-session`. You can create a proxy or call the Supabase function endpoint directly from the frontend.

Notes:
- The function is written for Deno (Supabase Edge Functions). Local TypeScript/VSCode may show errors because Deno globals are not available.
- Make sure to configure CORS/allowed origins if calling from browser directly.

Additional instructions — how to configure keys and deploy
------------------------------------------------------

1) Required environment variables (secure: do NOT commit secrets to your repo):

   - STRIPE_SECRET_KEY: Your Stripe secret key (starts with `sk_...`).
   - STRIPE_PRICE_BASIC: Stripe Price ID for the Basic recurring price (starts with `price_...`).
   - STRIPE_PRICE_PRO: Stripe Price ID for the Pro recurring price.
   - STRIPE_PRICE_BUSINESS: Stripe Price ID for the Business recurring price.
   - FRONTEND_SUCCESS_URL: Full URL your users should return to after successful payment (e.g. `https://app.example.com/plans`).
   - FRONTEND_CANCEL_URL: Full URL to return to if the user cancels checkout (e.g. `https://app.example.com/plans`).

   Optional (frontend):
   - VITE_STRIPE_PUBLISHABLE_KEY: The Stripe publishable key (starts with `pk_...`) — set this in your frontend environment so you can use Stripe.js if needed.

2) How to set them (Supabase dashboard):

   - Open your project in supabase.com.
   - Go to Functions -> select `create-checkout-session` -> (Settings / Environment Variables) and add the variables above.
   - Deploy the function after saving environment variables.

3) How to set them (Supabase CLI):

   - You can also set env vars through the dashboard, or via the CLI if your setup supports it. Example (adjust commands to your environment):

     - Use the Supabase dashboard for functions if you're unsure.

4) Local development notes:

   - Do NOT put `STRIPE_SECRET_KEY` in your frontend environment. The secret key must remain server-side (the Edge Function).
   - For local frontend development, add `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx` to your local env file (e.g. `.env.local`), but keep `STRIPE_SECRET_KEY` only in Supabase Functions env.
   - If you need to test the function locally, run it with the Supabase Functions tooling or Deno and provide the environment variables to that runtime. The exact local flow depends on how you run Edge Functions in your dev environment.

5) After deploying the function:

   - The frontend can call the function via `supabase.functions.invoke('create-checkout-session', { body: { planType, userId } })` (this repo already uses that).
   - The function will return `{ sessionUrl, sessionId }`. Redirect the user to `sessionUrl` to complete the Checkout.

Security notice
---------------

- Never commit `STRIPE_SECRET_KEY` to source control. Rotate the key in the Stripe Dashboard immediately if this secret has been shared publicly.
- Keep the publishable key (`pk_...`) public in frontend code; it is safe to expose.

Next steps (recommended)
------------------------

- Create Stripe webhook endpoint to listen for `checkout.session.completed` and update your `user_plans` row to set `status: 'active'` when payment succeeds. This ensures the DB reflects active subscriptions automatically.
- If you implement a webhook function (recommended), set these additional env vars for the webhook in Supabase Functions:
   - STRIPE_WEBHOOK_SECRET: the secret for verifying webhook signatures (from Stripe Dashboard -> Webhooks -> Click endpoint -> Reveal signing secret)
   - SUPABASE_SERVICE_ROLE_KEY: your Supabase service role key (used by the webhook to update the DB). Keep it secret.
- Add price IDs to Supabase env vars (`STRIPE_PRICE_BASIC`, etc.) before calling the function.
- If you'd like, I can add a small README snippet in the project root with example `.env` keys for local dev (without secrets), and/or implement a Stripe webhook function to finalize subscriptions.
