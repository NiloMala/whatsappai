-- Add agent_id to mini_sites table to link mini site to an AI agent
ALTER TABLE public.mini_sites
ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_mini_sites_agent_id ON public.mini_sites(agent_id);

-- Comment
COMMENT ON COLUMN public.mini_sites.agent_id IS 'AI Agent que processará os pedidos do mini site';
