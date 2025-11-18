-- Function to automatically populate webhook_url from workflow_id
CREATE OR REPLACE FUNCTION auto_populate_webhook_url()
RETURNS TRIGGER AS $$
BEGIN
  -- If workflow_id exists and webhook_url is empty, construct webhook_url
  IF NEW.workflow_id IS NOT NULL AND (NEW.webhook_url IS NULL OR NEW.webhook_url = '') THEN
    NEW.webhook_url := 'https://webhook.auroratech.tech/webhook/' || NEW.workflow_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run before insert or update on agents table
DROP TRIGGER IF EXISTS trigger_auto_populate_webhook_url ON agents;
CREATE TRIGGER trigger_auto_populate_webhook_url
  BEFORE INSERT OR UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_webhook_url();

-- Update existing agents that don't have webhook_url
UPDATE agents
SET webhook_url = 'https://webhook.auroratech.tech/webhook/' || workflow_id
WHERE workflow_id IS NOT NULL AND (webhook_url IS NULL OR webhook_url = '');
