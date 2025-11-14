-- Add event_type column to agent_schedule_config table
ALTER TABLE agent_schedule_config
ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'Consulta';

-- Add comment to explain the column
COMMENT ON COLUMN agent_schedule_config.event_type IS 'Default event type for calendar scheduling (e.g., Consulta, Reunião, Atendimento)';
