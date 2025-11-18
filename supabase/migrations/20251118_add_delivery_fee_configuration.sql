-- Add delivery fee configuration fields to mini_sites table
-- This allows configuring fixed delivery fees or per-neighborhood fees

ALTER TABLE mini_sites
ADD COLUMN IF NOT EXISTS delivery_fee_type TEXT CHECK (delivery_fee_type IN ('fixed', 'by_neighborhood')),
ADD COLUMN IF NOT EXISTS delivery_fee_value DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_neighborhoods JSONB DEFAULT '[]'::jsonb;

-- Add comment to explain the structure
COMMENT ON COLUMN mini_sites.delivery_fee_type IS 'Type of delivery fee: fixed (same for all) or by_neighborhood (different per neighborhood)';
COMMENT ON COLUMN mini_sites.delivery_fee_value IS 'Fixed delivery fee value (used when delivery_fee_type is fixed)';
COMMENT ON COLUMN mini_sites.delivery_neighborhoods IS 'Array of neighborhoods with their delivery fees: [{"name": "Centro", "fee": 5.00}]';
