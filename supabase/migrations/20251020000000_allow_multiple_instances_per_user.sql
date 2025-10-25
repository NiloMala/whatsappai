-- Remove UNIQUE constraint from user_id to allow multiple instances per user
-- This allows users to have multiple WhatsApp instances based on their plan

ALTER TABLE public.whatsapp_connections 
DROP CONSTRAINT IF EXISTS whatsapp_connections_user_id_key;

-- Add index for better query performance on user_id lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_user_id 
ON public.whatsapp_connections(user_id);

-- Add index on instance_key for lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_instance_key 
ON public.whatsapp_connections(instance_key);
