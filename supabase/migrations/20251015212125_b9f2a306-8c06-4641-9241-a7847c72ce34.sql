-- Create enum for plan types
CREATE TYPE public.plan_type AS ENUM ('basic', 'pro', 'business');

-- Create plans table
CREATE TABLE public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  plan_type plan_type NOT NULL UNIQUE,
  price DECIMAL(10,2) NOT NULL,
  max_instances INTEGER NOT NULL,
  max_agents INTEGER NOT NULL,
  support_level TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_plans table to track active plans
CREATE TABLE public.user_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_type plan_type NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

-- Plans are viewable by everyone (public pricing)
CREATE POLICY "Plans are viewable by everyone"
ON public.plans
FOR SELECT
USING (true);

-- User plans policies
CREATE POLICY "Users can view own plan"
ON public.user_plans
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plan"
ON public.user_plans
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plan"
ON public.user_plans
FOR UPDATE
USING (auth.uid() = user_id);

-- Insert default plans
INSERT INTO public.plans (name, plan_type, price, max_instances, max_agents, support_level) VALUES
('Basic', 'basic', 49.90, 1, 1, 'Suporte básico via e-mail'),
('Pro', 'pro', 79.90, 2, 2, 'Suporte prioritário via chat'),
('Business', 'business', 99.90, 5, 5, 'Suporte dedicado via WhatsApp e e-mail');

-- Trigger for updated_at
CREATE TRIGGER update_plans_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_plans_updated_at
BEFORE UPDATE ON public.user_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();