-- Migration: add color columns to mini_sites
-- Date: 2025-11-14

BEGIN;

-- Add new nullable text columns so frontend can store color preferences
ALTER TABLE public.mini_sites
  ADD COLUMN IF NOT EXISTS background_color text,
  ADD COLUMN IF NOT EXISTS button_color text,
  ADD COLUMN IF NOT EXISTS text_color text;

-- OPTIONAL: backfill new columns from existing theme_color (uncomment to run)
-- This will set the button color to the current theme_color so existing sites keep similar appearance
-- UPDATE public.mini_sites SET button_color = theme_color WHERE button_color IS NULL;
-- You can also set a sensible default for text color (e.g. black) if needed:
-- UPDATE public.mini_sites SET text_color = '#000000' WHERE text_color IS NULL;

COMMIT;
