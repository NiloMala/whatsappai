-- Add user_id column to kanban_cards table
ALTER TABLE kanban_cards
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_kanban_cards_user_id ON kanban_cards(user_id);

-- Enable RLS (Row Level Security)
ALTER TABLE kanban_cards ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own kanban cards" ON kanban_cards;
DROP POLICY IF EXISTS "Users can insert their own kanban cards" ON kanban_cards;
DROP POLICY IF EXISTS "Users can update their own kanban cards" ON kanban_cards;
DROP POLICY IF EXISTS "Users can delete their own kanban cards" ON kanban_cards;

-- Create RLS policies
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
