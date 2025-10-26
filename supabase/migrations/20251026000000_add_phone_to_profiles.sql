-- Add phone column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add comment to the column
COMMENT ON COLUMN profiles.phone IS 'User phone number for contact';

-- Optional: Add index for phone lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
