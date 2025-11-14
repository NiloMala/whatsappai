-- Adicionar campo delivery_info para informações de entrega
ALTER TABLE public.mini_sites
ADD COLUMN IF NOT EXISTS delivery_info TEXT;

COMMENT ON COLUMN public.mini_sites.delivery_info IS 'Informações sobre entrega, tempo estimado, taxas, etc';
