-- Corrigir contadores de mensagens NULL em registros existentes
-- Atualizar todos os registros onde messages_used_current_month é NULL
UPDATE public.user_plans
SET
  messages_used_current_month = 0,
  last_reset_date = COALESCE(last_reset_date, CURRENT_DATE)
WHERE messages_used_current_month IS NULL;

-- Garantir que messages_limit também não seja NULL
UPDATE public.user_plans
SET messages_limit = CASE
  WHEN plan_type = 'basic' THEN 500
  WHEN plan_type = 'pro' THEN 1000
  WHEN plan_type = 'business' THEN 999999
  ELSE 1000
END
WHERE messages_limit IS NULL;

-- Adicionar constraint NOT NULL (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_plans'
    AND column_name = 'messages_used_current_month'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.user_plans
    ALTER COLUMN messages_used_current_month SET DEFAULT 0,
    ALTER COLUMN messages_used_current_month SET NOT NULL;
  END IF;
END $$;

-- Garantir que novos registros sempre tenham valores válidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_plans'
    AND column_name = 'messages_limit'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.user_plans
    ALTER COLUMN messages_limit SET DEFAULT 1000,
    ALTER COLUMN messages_limit SET NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.user_plans.messages_used_current_month IS 'Contador de mensagens usadas no mês atual (NOT NULL, reseta automaticamente)';
COMMENT ON COLUMN public.user_plans.messages_limit IS 'Limite mensal de mensagens (NOT NULL, Basic: 500, Pro: 1000, Business: 999999)';
