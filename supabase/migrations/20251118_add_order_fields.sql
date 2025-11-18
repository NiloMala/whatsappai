-- Add missing fields to minisite_orders table
-- This adds customer neighborhood, delivery fee, and notes/observations

ALTER TABLE minisite_orders
ADD COLUMN IF NOT EXISTS customer_neighborhood TEXT,
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Rename total to total_amount for consistency (only if total exists and total_amount doesn't)
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

-- Rename observations to notes for consistency (if observations exists and notes doesn't)
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

-- Add total_amount if it doesn't exist and total doesn't exist either
ALTER TABLE minisite_orders
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12, 2) DEFAULT 0;

-- Add comments
COMMENT ON COLUMN minisite_orders.customer_neighborhood IS 'Customer neighborhood for delivery';
COMMENT ON COLUMN minisite_orders.delivery_fee IS 'Delivery fee charged for this order';
COMMENT ON COLUMN minisite_orders.notes IS 'Order notes/observations from customer';
COMMENT ON COLUMN minisite_orders.total_amount IS 'Total order amount including delivery fee';
