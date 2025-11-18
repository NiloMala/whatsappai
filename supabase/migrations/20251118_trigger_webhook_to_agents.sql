-- Trigger para popular webhook_url nos agentes quando webhook é criado/atualizado
CREATE OR REPLACE FUNCTION sync_webhook_to_agents()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando um webhook é inserido ou atualizado, atualiza os agentes correspondentes
  UPDATE agents
  SET webhook_url = NEW.url
  WHERE user_id = NEW.user_id
    AND (
      -- Match por instance_name se existir
      (instance_name IS NOT NULL AND instance_name = NEW.instance_id)
      OR
      -- Se não tem instance_name, atualiza qualquer agente do mesmo usuário que não tenha webhook_url
      (instance_name IS NULL AND (webhook_url IS NULL OR webhook_url = ''))
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger na tabela webhooks
DROP TRIGGER IF EXISTS trigger_sync_webhook_to_agents ON webhooks;
CREATE TRIGGER trigger_sync_webhook_to_agents
  AFTER INSERT OR UPDATE ON webhooks
  FOR EACH ROW
  EXECUTE FUNCTION sync_webhook_to_agents();

-- Atualizar agentes existentes com webhooks já criados
UPDATE agents a
SET webhook_url = w.url
FROM webhooks w
WHERE a.user_id = w.user_id
  AND w.ativo = true
  AND (a.webhook_url IS NULL OR a.webhook_url = '')
  AND (
    (a.instance_name IS NOT NULL AND a.instance_name = w.instance_id)
    OR (a.instance_name IS NULL)
  );
