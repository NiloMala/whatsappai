-- Add card_color column to mini_sites table
ALTER TABLE public.mini_sites
ADD COLUMN IF NOT EXISTS card_color TEXT DEFAULT '#ffffff';

COMMENT ON COLUMN public.mini_sites.card_color IS 'Cor de fundo dos cards de produtos e modais';
