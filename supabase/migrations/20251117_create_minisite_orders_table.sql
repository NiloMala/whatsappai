-- Migration: Create minisite_orders table
-- Date: 2025-11-17
-- Purpose: Persist orders created from minisite before sending to WhatsApp/agent

BEGIN;

-- Create table to store orders from minisites
CREATE TABLE IF NOT EXISTS public.minisite_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mini_site_id uuid,
  user_id uuid,
  profile_id uuid,
  customer_name text,
  customer_phone text,
  customer_address text,
  items jsonb NOT NULL,
  total numeric(12,2) DEFAULT 0,
  payment_method text,
  observations text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Optionally add foreign key constraints if your schema has these tables.
-- If these referenced tables don't exist in your project, skip or adapt.
DO $$
BEGIN
  -- Use to_regclass to check for fully-qualified table existence before
  -- attempting to add foreign key constraints. This prevents errors when
  -- referenced tables live in other schemas (e.g. auth.users) or don't exist.
  IF to_regclass('public.mini_sites') IS NOT NULL THEN
    ALTER TABLE public.minisite_orders
      ADD CONSTRAINT minisite_orders_minisite_fk FOREIGN KEY (mini_site_id) REFERENCES public.mini_sites(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.minisite_profiles') IS NOT NULL THEN
    ALTER TABLE public.minisite_orders
      ADD CONSTRAINT minisite_orders_profile_fk FOREIGN KEY (profile_id) REFERENCES public.minisite_profiles(id) ON DELETE SET NULL;
  END IF;

  -- Some projects keep auth users in the `auth` schema; only add FK to
  -- `public.users` if that table actually exists in public schema.
  IF to_regclass('public.users') IS NOT NULL THEN
    ALTER TABLE public.minisite_orders
      ADD CONSTRAINT minisite_orders_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END$$;

-- Indexes to speed up common queries
CREATE INDEX IF NOT EXISTS idx_minisite_orders_mini_site_id ON public.minisite_orders(mini_site_id);
CREATE INDEX IF NOT EXISTS idx_minisite_orders_user_id ON public.minisite_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_minisite_orders_profile_id ON public.minisite_orders(profile_id);

-- Trigger function to update `updated_at`
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.minisite_orders;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.minisite_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;

-- Notes:
-- * Run this migration in your Supabase SQL editor or via your migration tooling.
-- * If `gen_random_uuid()` is not available in your Postgres, enable the pgcrypto
--   extension or replace with `uuid_generate_v4()` (and ensure uuid-ossp extension).
