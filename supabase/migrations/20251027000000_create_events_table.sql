-- Create events table for calendar functionality
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Constraint to ensure end_time is after start_time
  CONSTRAINT events_end_after_start CHECK (end_time > start_time)
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for events
CREATE POLICY "Users can view own events" ON public.events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events" ON public.events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events" ON public.events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own events" ON public.events
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_events_user_id ON public.events(user_id);
CREATE INDEX idx_events_start_time ON public.events(start_time);
CREATE INDEX idx_events_end_time ON public.events(end_time);
CREATE INDEX idx_events_user_start ON public.events(user_id, start_time);
CREATE INDEX idx_events_user_end ON public.events(user_id, end_time);

-- Add trigger for updated_at
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.events IS 'Calendar events for users';
COMMENT ON COLUMN public.events.title IS 'Event title';
COMMENT ON COLUMN public.events.description IS 'Optional event description';
COMMENT ON COLUMN public.events.start_time IS 'Event start date and time';
COMMENT ON COLUMN public.events.end_time IS 'Event end date and time';
COMMENT ON COLUMN public.events.user_id IS 'Reference to the user who owns the event';