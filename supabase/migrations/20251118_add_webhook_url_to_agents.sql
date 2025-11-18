-- Add webhook_url column to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN agents.webhook_url IS 'Full webhook URL for the agent (e.g., https://webhook.auroratech.tech/webhook/{uuid})';

-- Update existing agents to construct webhook_url from workflow_id if it exists
UPDATE agents
SET webhook_url = 'https://webhook.auroratech.tech/webhook/' || workflow_id
WHERE workflow_id IS NOT NULL AND webhook_url IS NULL;
