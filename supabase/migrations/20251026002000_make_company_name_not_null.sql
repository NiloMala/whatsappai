-- Ensure existing rows have a non-null company_name, then make the column NOT NULL
BEGIN;

-- Set empty string for any NULL company_name to avoid blocking the NOT NULL change
UPDATE profiles
SET company_name = ''
WHERE company_name IS NULL;

-- Alter column to NOT NULL
ALTER TABLE profiles
ALTER COLUMN company_name SET NOT NULL;

COMMIT;

-- Add a comment to clarify the purpose
COMMENT ON COLUMN profiles.company_name IS 'Company name for the user (required)';
