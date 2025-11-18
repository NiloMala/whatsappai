-- Update the auto-populate function to get webhook_url from webhooks table
CREATE OR REPLACE FUNCTION auto_populate_webhook_url()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url_from_table TEXT;
BEGIN
  -- If webhook_url is empty, try to get it from webhooks table
  IF NEW.webhook_url IS NULL OR NEW.webhook_url = '' THEN
    -- Try to find webhook by instance_name (if agent has instance_name)
    IF NEW.instance_name IS NOT NULL THEN
      SELECT url INTO webhook_url_from_table
      FROM public.webhooks
      WHERE instance_id = NEW.instance_name
        AND user_id = NEW.user_id
        AND ativo = true
      ORDER BY created_at DESC
      LIMIT 1;

      -- If found, set the webhook_url
      IF webhook_url_from_table IS NOT NULL THEN
        NEW.webhook_url := webhook_url_from_table;
        RETURN NEW;
      END IF;
    END IF;

    -- Fallback: if no instance_name match, try to get any active webhook for this user
    IF NEW.webhook_url IS NULL OR NEW.webhook_url = '' THEN
      SELECT url INTO webhook_url_from_table
      FROM public.webhooks
      WHERE user_id = NEW.user_id
        AND ativo = true
      ORDER BY created_at DESC
      LIMIT 1;

      IF webhook_url_from_table IS NOT NULL THEN
        NEW.webhook_url := webhook_url_from_table;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_auto_populate_webhook_url ON agents;
CREATE TRIGGER trigger_auto_populate_webhook_url
  BEFORE INSERT OR UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_webhook_url();

-- Update existing agents that don't have webhook_url by querying webhooks table
UPDATE agents a
SET webhook_url = w.url
FROM webhooks w
WHERE a.user_id = w.user_id
  AND (a.webhook_url IS NULL OR a.webhook_url = '')
  AND w.ativo = true
  AND (
    (a.instance_name IS NOT NULL AND w.instance_id = a.instance_name)
    OR (a.instance_name IS NULL)
  );
