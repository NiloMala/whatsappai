-- Add new columns to agents table
ALTER TABLE agents 
ADD COLUMN provider text,
ADD COLUMN api_key text,
ADD COLUMN workflow_json jsonb;