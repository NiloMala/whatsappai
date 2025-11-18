-- Verificar se o trigger existe
SELECT
  tgname as trigger_name,
  tgenabled as enabled,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'trigger_auto_populate_webhook_url';

-- Ver dados do agente recém criado
SELECT
  id,
  name,
  user_id,
  instance_name,
  workflow_id,
  webhook_url,
  created_at
FROM agents
ORDER BY created_at DESC
LIMIT 3;

-- Ver dados dos webhooks disponíveis
SELECT
  id,
  instance_id,
  user_id,
  url,
  ativo,
  created_at
FROM webhooks
ORDER BY created_at DESC
LIMIT 3;

-- Verificar se há match entre agent e webhook pelo user_id
SELECT
  a.id as agent_id,
  a.name as agent_name,
  a.user_id as agent_user_id,
  a.instance_name as agent_instance_name,
  a.webhook_url as agent_webhook_url,
  w.id as webhook_id,
  w.instance_id as webhook_instance_id,
  w.url as webhook_url,
  w.ativo as webhook_ativo
FROM agents a
LEFT JOIN webhooks w ON a.user_id = w.user_id
WHERE a.webhook_url IS NULL OR a.webhook_url = ''
ORDER BY a.created_at DESC
LIMIT 5;
