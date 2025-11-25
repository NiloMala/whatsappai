-- Script de teste para verificar se o incremento de mensagens está funcionando
-- Execute este script no Supabase SQL Editor

-- 1. Verificar estado atual do user_plan
SELECT
  user_id,
  messages_used_current_month,
  messages_limit,
  plan_type,
  last_reset_date
FROM public.user_plans
WHERE user_id = 'e2165d22-a30e-4d93-a0c3-3d90a7302ad2'::uuid;

-- 2. Testar a função check_and_reset_message_counter
SELECT * FROM check_and_reset_message_counter('e2165d22-a30e-4d93-a0c3-3d90a7302ad2'::uuid);

-- 3. Testar a função increment_message_counter
SELECT increment_message_counter('e2165d22-a30e-4d93-a0c3-3d90a7302ad2'::uuid);

-- 4. Verificar se incrementou
SELECT
  user_id,
  messages_used_current_month,
  messages_limit,
  plan_type
FROM public.user_plans
WHERE user_id = 'e2165d22-a30e-4d93-a0c3-3d90a7302ad2'::uuid;

-- 5. Se quiser resetar para testar novamente, descomente a linha abaixo:
-- UPDATE public.user_plans SET messages_used_current_month = 0 WHERE user_id = 'e2165d22-a30e-4d93-a0c3-3d90a7302ad2'::uuid;
