-- Corrigir função de incremento para lidar com valores NULL
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

  -- Incrementar contador (COALESCE garante que NULL seja tratado como 0)
  UPDATE public.user_plans
  SET messages_used_current_month = COALESCE(messages_used_current_month, 0) + 1
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION increment_message_counter(UUID) IS 'Incrementa contador de mensagens (trata NULL como 0) e retorna false se atingiu limite';
