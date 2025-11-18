-- Execute este SQL diretamente no Supabase SQL Editor
-- para corrigir a tabela minisite_orders

-- 1. Adicionar campos faltantes
ALTER TABLE minisite_orders
ADD COLUMN IF NOT EXISTS customer_neighborhood TEXT,
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Renomear total para total_amount (se necessário)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'minisite_orders' AND column_name = 'total'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'minisite_orders' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE minisite_orders RENAME COLUMN total TO total_amount;
  END IF;
END $$;

-- 3. Renomear observations para notes (se necessário)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'minisite_orders' AND column_name = 'observations'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'minisite_orders' AND column_name = 'notes'
  ) THEN
    ALTER TABLE minisite_orders RENAME COLUMN observations TO notes;
  END IF;
END $$;

-- 4. Criar total_amount se não existir
ALTER TABLE minisite_orders
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12, 2) DEFAULT 0;

-- 5. Verificar estrutura final
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'minisite_orders'
AND table_schema = 'public'
ORDER BY ordinal_position;
