-- Adicionar controle de limite de mensagens por plano
-- Basic: 500 mensagens/mês
-- Pro: 1.000 mensagens/mês
-- Business: Ilimitado (999999)

-- Adicionar campos de controle de limite
ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS messages_limit INTEGER DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS messages_used_current_month INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reset_date DATE DEFAULT CURRENT_DATE;

-- Atualizar limites baseados no plano atual
UPDATE public.user_plans up
SET messages_limit = CASE
  WHEN up.plan_type = 'basic' THEN 500
  WHEN up.plan_type = 'pro' THEN 1000
  WHEN up.plan_type = 'business' THEN 999999
  ELSE 1000
END
WHERE messages_limit IS NULL OR messages_limit = 1000;

-- Criar índice para performance em consultas de limite
CREATE INDEX IF NOT EXISTS idx_user_plans_user_id_messages
ON public.user_plans(user_id, messages_used_current_month);

-- Função para resetar contadores mensalmente
-- Esta função será executada automaticamente quando o plano for renovado
CREATE OR REPLACE FUNCTION reset_monthly_message_counter(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.user_plans
  SET
    messages_used_current_month = 0,
    last_reset_date = CURRENT_DATE
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar e auto-resetar contador se mudou o mês
CREATE OR REPLACE FUNCTION check_and_reset_message_counter(p_user_id UUID)
RETURNS TABLE(
  limit_reached BOOLEAN,
  messages_used INTEGER,
  messages_limit INTEGER,
  remaining INTEGER
) AS $$
DECLARE
  v_user_plan RECORD;
  v_today DATE;
  v_last_reset DATE;
BEGIN
  v_today := CURRENT_DATE;

  SELECT * INTO v_user_plan
  FROM public.user_plans
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_user_plan IS NULL THEN
    RAISE EXCEPTION 'User plan not found';
  END IF;

  v_last_reset := v_user_plan.last_reset_date;

  -- Reset automático se mudou o mês
  IF EXTRACT(MONTH FROM v_today) != EXTRACT(MONTH FROM v_last_reset)
     OR EXTRACT(YEAR FROM v_today) != EXTRACT(YEAR FROM v_last_reset) THEN

    UPDATE public.user_plans
    SET
      messages_used_current_month = 0,
      last_reset_date = v_today
    WHERE user_id = p_user_id;

    v_user_plan.messages_used_current_month := 0;
    v_user_plan.last_reset_date := v_today;
  END IF;

  -- Retornar status atual
  RETURN QUERY SELECT
    v_user_plan.messages_used_current_month >= v_user_plan.messages_limit,
    v_user_plan.messages_used_current_month,
    v_user_plan.messages_limit,
    GREATEST(0, v_user_plan.messages_limit - v_user_plan.messages_used_current_month);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para incrementar contador de mensagens
CREATE OR REPLACE FUNCTION increment_message_counter(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_status RECORD;
BEGIN
  -- Verificar e resetar se necessário
  SELECT * INTO v_status
  FROM check_and_reset_message_counter(p_user_id);

  -- Se já atingiu o limite, retornar false
  IF v_status.limit_reached THEN
    RETURN FALSE;
  END IF;

  -- Incrementar contador
  UPDATE public.user_plans
  SET messages_used_current_month = messages_used_current_month + 1
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para resetar contador quando o plano é renovado
CREATE OR REPLACE FUNCTION trigger_reset_on_plan_renewal()
RETURNS TRIGGER AS $$
BEGIN
  -- Se expires_at foi atualizado para uma data futura, resetar contador
  IF NEW.expires_at IS NOT NULL
     AND OLD.expires_at IS NOT NULL
     AND NEW.expires_at > OLD.expires_at THEN

    NEW.messages_used_current_month := 0;
    NEW.last_reset_date := CURRENT_DATE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS reset_message_counter_on_renewal ON public.user_plans;
CREATE TRIGGER reset_message_counter_on_renewal
  BEFORE UPDATE ON public.user_plans
  FOR EACH ROW
  WHEN (NEW.expires_at IS DISTINCT FROM OLD.expires_at)
  EXECUTE FUNCTION trigger_reset_on_plan_renewal();

-- Comentários para documentação
COMMENT ON COLUMN public.user_plans.messages_limit IS 'Limite mensal de mensagens respondidas pelo agente (Basic: 500, Pro: 1000, Business: ilimitado)';
COMMENT ON COLUMN public.user_plans.messages_used_current_month IS 'Contador de mensagens usadas no mês atual (reseta automaticamente)';
COMMENT ON COLUMN public.user_plans.last_reset_date IS 'Data do último reset do contador (renovação ou mudança de mês)';

COMMENT ON FUNCTION check_and_reset_message_counter(UUID) IS 'Verifica se atingiu limite e auto-reseta se mudou o mês';
COMMENT ON FUNCTION increment_message_counter(UUID) IS 'Incrementa contador de mensagens e retorna false se atingiu limite';
COMMENT ON FUNCTION reset_monthly_message_counter(UUID) IS 'Reseta manualmente o contador de mensagens de um usuário';
