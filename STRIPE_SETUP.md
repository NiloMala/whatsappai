# Configuração Stripe + Supabase Edge Functions

## Passo 1: Obter chaves do Stripe

1. Entre no [Stripe Dashboard](https://dashboard.stripe.com)
2. Ative **Test mode** (toggle no canto superior direito)
3. Vá em **Developers → API keys**
4. Copie:
   - **Publishable key** (pk_test_...)
   - **Secret key** (sk_test_...) — **mantenha secreta**

## Passo 2: Criar produtos e preços no Stripe

1. No Stripe Dashboard → **Products**
2. Crie 3 produtos (Basic, Pro, Business) com preços recorrentes (subscription)
3. Copie os **Price IDs** (começam com `price_...`) de cada um

Exemplo dos seus Price IDs:
- Basic: `price_1SLThoA02hrzA9N3LVML0xNB`
- Pro: `price_1SLTjhA02hrzA9N3zJ5AcRoF`
- Business: `price_1SLW9SA02hrzA9N3X0ArjNLa`

## Passo 3: Configurar secrets no Supabase (via CLI)

Abra PowerShell no diretório do projeto e execute:

```powershell
cd f:\whatsagenteai-2.0-main

# Configurar todos os secrets de uma vez (substitua SK_TEST por sua chave real)
supabase secrets set `
  STRIPE_SECRET_KEY="sk_test_SUA_CHAVE_AQUI" `
  STRIPE_PRICE_BASIC="price_1SLThoA02hrzA9N3LVML0xNB" `
  STRIPE_PRICE_PRO="price_1SLTjhA02hrzA9N3zJ5AcRoF" `
  STRIPE_PRICE_BUSINESS="price_1SLW9SA02hrzA9N3X0ArjNLa" `
  FRONTEND_SUCCESS_URL="http://localhost:8080/plans?status=success" `
  FRONTEND_CANCEL_URL="http://localhost:8080/plans?status=cancel" `
  SUPABASE_URL="https://cvyagrunpypnznptkcsf.supabase.co" `
  SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2eWFncnVucHlwbnpucHRrY3NmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDczMDAwMiwiZXhwIjoyMDc2MzA2MDAyfQ.1IZVvADKlba28sZr5EQORit1stwC12so8fVWHemQLAs"
```

**Verificar secrets definidos:**
```powershell
supabase secrets list
```

## Passo 4: Configurar webhook do Stripe

1. No Stripe Dashboard → **Developers → Webhooks**
2. Clique em **Add endpoint**
3. Preencha:
   - **Endpoint URL**: `https://cvyagrunpypnznptkcsf.supabase.co/functions/v1/stripe-webhook`
   - **Events to send**: selecione:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
4. Após criar, clique no endpoint → **Reveal** signing secret
5. Copie o `whsec_...` e adicione aos secrets:

```powershell
supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_COLE_AQUI"
```

## Passo 5: Testar o fluxo

1. Abra app em `http://localhost:8080`
2. Faça login com usuário de teste
3. Vá para `/plans` e clique em **Assinar** em qualquer plano
4. Complete o Checkout com cartão de teste:
   - Número: `4242 4242 4242 4242`
   - Data: qualquer MM/YY futuro
   - CVC: `123`
   - CEP: qualquer
5. Verifique:
   - Redirecionamento para SUCCESS_URL
   - No Supabase → Table Editor → `user_plans`: registro com `status: 'active'`
   - No Stripe Dashboard → Payments: pagamento registrado

## Passo 6: Ver logs das funções

- Dashboard Supabase → Edge Functions → selecione a função → aba **Logs**
- Procure por invocações recentes e erros (se houver)

## Troubleshooting

### Erro 400 (Bad Request)
- Verifique se os secrets estão definidos: `supabase secrets list`
- Verifique logs da função para mensagem de erro detalhada
- Certifique-se de que os Price IDs estão corretos no Stripe

### CORS bloqueado
- As funções já incluem headers CORS corretos
- Se necessário, restrinja origins com: `FRONTEND_ALLOWED_ORIGINS="http://localhost:8080"`

### Webhook não recebe eventos
- Verifique se `STRIPE_WEBHOOK_SECRET` está configurado
- Use Stripe CLI para testar localmente:
  ```bash
  stripe listen --forward-to https://cvyagrunpypnznptkcsf.supabase.co/functions/v1/stripe-webhook
  stripe trigger checkout.session.completed
  ```

## Modo produção

Quando estiver pronto para produção:

1. No Stripe, desative **Test mode** e copie as chaves **live** (sk_live_..., pk_live_...)
2. Atualize os secrets com as chaves live:
   ```powershell
   supabase secrets set STRIPE_SECRET_KEY="sk_live_SUA_CHAVE_LIVE"
   ```
3. Crie um novo webhook endpoint em **Live mode** e atualize `STRIPE_WEBHOOK_SECRET`
4. Atualize `FRONTEND_SUCCESS_URL` e `FRONTEND_CANCEL_URL` para URLs de produção
5. **Importante**: Rotacione a `sk_live_` se ela foi compartilhada/exposta

## Segurança

- ✅ Nunca commit `STRIPE_SECRET_KEY` no repositório
- ✅ Use secrets do Supabase para variáveis sensíveis
- ✅ Rotacione chaves se expostas
- ✅ Use Test mode durante desenvolvimento
- ✅ Valide assinatura do webhook (já implementado)
