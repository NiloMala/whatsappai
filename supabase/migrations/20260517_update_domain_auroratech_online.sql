-- Update trigger function to use new domain auroratech.online
CREATE OR REPLACE FUNCTION auto_populate_webhook_url()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.workflow_id IS NOT NULL AND (NEW.webhook_url IS NULL OR NEW.webhook_url = '') THEN
    NEW.webhook_url := 'https://webhook.auroratech.online/webhook/' || NEW.workflow_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update existing agents that still have the old domain
UPDATE agents
SET webhook_url = 'https://webhook.auroratech.online/webhook/' || workflow_id
WHERE workflow_id IS NOT NULL
  AND webhook_url LIKE 'https://webhook.auroratech.tech/%';
