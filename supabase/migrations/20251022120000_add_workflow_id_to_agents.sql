-- Add workflow_id column to agents table to track n8n workflow
ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS workflow_id TEXT;

-- Add index for faster workflow_id lookups
CREATE INDEX IF NOT EXISTS idx_agents_workflow_id ON public.agents(workflow_id);

-- Add comment to document the column
COMMENT ON COLUMN public.agents.workflow_id IS 'ID do workflow no n8n associado a este agente';
