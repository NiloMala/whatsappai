-- ===========================================
-- CALENDAR EVENTS DATABASE SETUP
-- Execute this entire file in Supabase SQL Editor
-- ===========================================

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

-- ===========================================
-- USEFUL FUNCTIONS FOR CALENDAR EVENTS
-- ===========================================

-- Function to get events for a specific date range
CREATE OR REPLACE FUNCTION get_events_in_range(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.description,
    e.start_time,
    e.end_time,
    e.created_at,
    e.updated_at
  FROM public.events e
  WHERE e.user_id = p_user_id
    AND e.start_time < p_end_date
    AND e.end_time > p_start_date
  ORDER BY e.start_time;
END;
$$;

-- Function to get events for a specific date (whole day)
CREATE OR REPLACE FUNCTION get_events_for_date(
  p_user_id UUID,
  p_date DATE
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.description,
    e.start_time,
    e.end_time,
    e.created_at,
    e.updated_at
  FROM public.events e
  WHERE e.user_id = p_user_id
    AND DATE(e.start_time) = p_date
  ORDER BY e.start_time;
END;
$$;

-- Function to check for conflicting events
CREATE OR REPLACE FUNCTION check_event_conflict(
  p_user_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_exclude_event_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conflict_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO conflict_count
  FROM public.events e
  WHERE e.user_id = p_user_id
    AND e.id != COALESCE(p_exclude_event_id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND (
      (e.start_time <= p_start_time AND e.end_time > p_start_time) OR
      (e.start_time < p_end_time AND e.end_time >= p_end_time) OR
      (e.start_time >= p_start_time AND e.end_time <= p_end_time)
    );

  RETURN conflict_count > 0;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_events_in_range(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_events_for_date(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION check_event_conflict(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;

-- ===========================================
-- SAMPLE DATA (OPTIONAL - FOR TESTING)
-- ===========================================

-- Uncomment and replace 'user-uuid-here' with actual user IDs to insert sample data
/*
INSERT INTO public.events (user_id, title, description, start_time, end_time) VALUES
('user-uuid-here', 'Reunião com cliente', 'Discussão sobre novo projeto', '2025-10-26 10:00:00+00', '2025-10-26 11:00:00+00'),
('user-uuid-here', 'Almoço', 'Almoço de negócios', '2025-10-26 12:00:00+00', '2025-10-26 13:00:00+00'),
('user-uuid-here', 'Treinamento equipe', 'Sessão de treinamento mensal', '2025-10-27 14:00:00+00', '2025-10-27 16:00:00+00'),
('user-uuid-here', 'Consulta médica', 'Check-up anual', '2025-10-28 09:30:00+00', '2025-10-28 10:30:00+00');
*/

-- ===========================================
-- SETUP COMPLETE
-- ===========================================

-- Verify the setup by running:
-- SELECT * FROM information_schema.tables WHERE table_name = 'events';
-- SELECT * FROM pg_policies WHERE tablename = 'events';