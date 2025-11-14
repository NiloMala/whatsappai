-- =====================================================
-- MIGRATION: Add user_id to kanban_cards
-- Execute this SQL in Supabase Studio SQL Editor
-- =====================================================

-- Step 1: Add user_id column to kanban_cards table
ALTER TABLE kanban_cards
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_kanban_cards_user_id ON kanban_cards(user_id);

-- Step 3: Enable RLS (Row Level Security)
ALTER TABLE kanban_cards ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own kanban cards" ON kanban_cards;
DROP POLICY IF EXISTS "Users can insert their own kanban cards" ON kanban_cards;
DROP POLICY IF EXISTS "Users can update their own kanban cards" ON kanban_cards;
DROP POLICY IF EXISTS "Users can delete their own kanban cards" ON kanban_cards;

-- Step 5: Create RLS policies
CREATE POLICY "Users can view their own kanban cards"
  ON kanban_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own kanban cards"
  ON kanban_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own kanban cards"
  ON kanban_cards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own kanban cards"
  ON kanban_cards FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- IMPORTANT: After running this migration:
-- 1. All existing kanban_cards will have user_id = NULL
-- 2. They will NOT be visible to any user due to RLS
-- 3. You need to assign user_id to existing cards OR delete them
--
-- To assign all existing cards to a specific user:
-- UPDATE kanban_cards SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;
--
-- To find your user_id:
-- SELECT id, email FROM auth.users;
-- =====================================================
