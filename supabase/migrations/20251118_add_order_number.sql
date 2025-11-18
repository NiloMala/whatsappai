-- Add order_number column to minisite_orders table
ALTER TABLE minisite_orders 
ADD COLUMN IF NOT EXISTS order_number INTEGER;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_minisite_orders_order_number 
ON minisite_orders(order_number);

-- Add a comment explaining the column
COMMENT ON COLUMN minisite_orders.order_number IS 
'Human-readable 8-digit order number for customer reference (e.g., 56923289)';
