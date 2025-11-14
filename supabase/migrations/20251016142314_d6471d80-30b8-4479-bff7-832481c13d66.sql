-- Criar tabela para armazenar credenciais dos usuários
CREATE TABLE public.user_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL, -- 'openai', 'groq', 'claude', 'ollama', 'evolution', 'redis', 'supabase'
  api_key TEXT NOT NULL,
  additional_config JSONB, -- Para configurações extras específicas de cada serviço
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, service_name)
);

-- Habilitar RLS
ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own credentials"
  ON public.user_credentials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credentials"
  ON public.user_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials"
  ON public.user_credentials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credentials"
  ON public.user_credentials FOR DELETE
  USING (auth.uid() = user_id);

-- Adicionar colunas à tabela agents
ALTER TABLE public.agents 
  ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS ai_model_name TEXT DEFAULT 'gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS instance_name TEXT,
  ADD COLUMN IF NOT EXISTS workflow_id TEXT;

-- Trigger para updated_at
CREATE TRIGGER update_user_credentials_updated_at
  BEFORE UPDATE ON public.user_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();