-- Add voice_response_mode column to agents table
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS voice_response_mode TEXT DEFAULT 'text_only' CHECK (voice_response_mode IN ('auto', 'text_only'));

-- Add comment to document the column
COMMENT ON COLUMN agents.voice_response_mode IS 'Voice response mode: auto (voice↔voice, text↔text) or text_only (always text)';
