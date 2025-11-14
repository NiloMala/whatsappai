-- Useful functions for calendar events

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