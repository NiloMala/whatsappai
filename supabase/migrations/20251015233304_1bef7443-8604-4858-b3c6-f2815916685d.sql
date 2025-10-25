-- Create webhooks table
CREATE TABLE public.webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  webhook_base64 BOOLEAN NOT NULL DEFAULT true,
  messages_upsert BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own webhooks"
ON public.webhooks
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own webhooks"
ON public.webhooks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own webhooks"
ON public.webhooks
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own webhooks"
ON public.webhooks
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_webhooks_instance_id ON public.webhooks(instance_id);
CREATE INDEX idx_webhooks_user_id ON public.webhooks(user_id);