-- Add Stripe subscription and trial fields to user_plans
ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP WITH TIME ZONE;

-- Update trigger exists already for updated_at; no trigger changes required.
