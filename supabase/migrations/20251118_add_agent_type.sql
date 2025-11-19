-- Add agent_type column to agents table
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS agent_type TEXT DEFAULT 'general';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_agents_agent_type ON agents(agent_type);

-- Add comment for documentation
COMMENT ON COLUMN agents.agent_type IS 'Type of agent: general, delivery, support, etc.';
