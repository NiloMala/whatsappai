-- Add unique constraint to conversations table for upsert
-- This allows the workflow to upsert conversations based on user_id + contact_phone

ALTER TABLE public.conversations
ADD CONSTRAINT conversations_user_contact_unique 
UNIQUE (user_id, contact_phone);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT conversations_user_contact_unique ON public.conversations 
IS 'Ensures one conversation per user per contact phone number';
