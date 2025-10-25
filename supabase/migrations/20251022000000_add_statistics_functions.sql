-- Migration: Add functions to compute real-time statistics from messages table
-- Created: 2025-10-22
-- Purpose: Calculate statistics based on actual platform messages (agent/AI sent)

-- Function to compute statistics for a specific user and date range
CREATE OR REPLACE FUNCTION public.get_user_statistics(
  p_user_id UUID,
  p_from_date DATE,
  p_to_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  date DATE,
  messages_received INTEGER,
  messages_sent INTEGER,
  avg_response_time_seconds INTEGER,
  active_contacts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_stats AS (
    SELECT
      DATE(m.created_at) as stat_date,
      -- Messages received from customers
      COUNT(CASE WHEN m.sender_type = 'customer' THEN 1 END)::INTEGER as received,
      -- Messages sent by platform (agent or AI generated)
      COUNT(CASE WHEN m.sender_type = 'agent' OR m.is_ai_generated = true THEN 1 END)::INTEGER as sent,
      -- Count unique conversations per day as active contacts
      COUNT(DISTINCT m.conversation_id)::INTEGER as contacts
    FROM public.messages m
    WHERE m.user_id = p_user_id
      AND DATE(m.created_at) >= p_from_date
      AND DATE(m.created_at) <= p_to_date
    GROUP BY DATE(m.created_at)
  ),
  response_times AS (
    SELECT
      DATE(customer_msg.created_at) as stat_date,
      AVG(
        EXTRACT(EPOCH FROM (agent_msg.created_at - customer_msg.created_at))
      )::INTEGER as avg_response
    FROM public.messages customer_msg
    INNER JOIN public.messages agent_msg
      ON agent_msg.conversation_id = customer_msg.conversation_id
      AND agent_msg.created_at > customer_msg.created_at
      AND agent_msg.user_id = customer_msg.user_id
      AND (agent_msg.sender_type = 'agent' OR agent_msg.is_ai_generated = true)
    WHERE customer_msg.user_id = p_user_id
      AND customer_msg.sender_type = 'customer'
      AND DATE(customer_msg.created_at) >= p_from_date
      AND DATE(customer_msg.created_at) <= p_to_date
      -- Only consider responses within 1 hour (3600 seconds) to avoid outliers
      AND EXTRACT(EPOCH FROM (agent_msg.created_at - customer_msg.created_at)) <= 3600
      AND agent_msg.id = (
        SELECT id FROM public.messages
        WHERE conversation_id = customer_msg.conversation_id
          AND created_at > customer_msg.created_at
          AND (sender_type = 'agent' OR is_ai_generated = true)
        ORDER BY created_at ASC
        LIMIT 1
      )
    GROUP BY DATE(customer_msg.created_at)
  )
  SELECT
    ds.stat_date as date,
    COALESCE(ds.received, 0)::INTEGER as messages_received,
    COALESCE(ds.sent, 0)::INTEGER as messages_sent,
    COALESCE(rt.avg_response, 0)::INTEGER as avg_response_time_seconds,
    COALESCE(ds.contacts, 0)::INTEGER as active_contacts
  FROM daily_stats ds
  LEFT JOIN response_times rt ON rt.stat_date = ds.stat_date
  ORDER BY ds.stat_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_statistics(UUID, DATE, DATE) TO authenticated;

-- Function to update statistics table (can be called manually or via cron)
CREATE OR REPLACE FUNCTION public.update_statistics_table(
  p_user_id UUID DEFAULT NULL,
  p_from_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days'
)
RETURNS void AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- If user_id is provided, update only for that user; otherwise update for all users
  FOR v_user_id IN 
    SELECT COALESCE(p_user_id, id) as uid
    FROM auth.users
    WHERE p_user_id IS NULL OR id = p_user_id
  LOOP
    -- Insert or update statistics for each day
    INSERT INTO public.statistics (user_id, date, messages_received, messages_sent, avg_response_time_seconds, active_contacts)
    SELECT
      v_user_id,
      s.date,
      s.messages_received,
      s.messages_sent,
      s.avg_response_time_seconds,
      s.active_contacts
    FROM public.get_user_statistics(v_user_id, p_from_date::DATE, CURRENT_DATE) s
    ON CONFLICT (user_id, date)
    DO UPDATE SET
      messages_received = EXCLUDED.messages_received,
      messages_sent = EXCLUDED.messages_sent,
      avg_response_time_seconds = EXCLUDED.avg_response_time_seconds,
      active_contacts = EXCLUDED.active_contacts,
      created_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_statistics_table(UUID, DATE) TO authenticated;

-- Create a trigger to automatically update statistics when messages are inserted
CREATE OR REPLACE FUNCTION public.trigger_update_statistics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update statistics for the current day when a message is inserted
  PERFORM public.update_statistics_table(NEW.user_id, DATE(NEW.created_at));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS messages_update_statistics ON public.messages;
CREATE TRIGGER messages_update_statistics
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_statistics();

-- Comment on functions
COMMENT ON FUNCTION public.get_user_statistics IS 'Computes real-time statistics from messages table for a specific user and date range. Only counts messages sent by agents or AI.';
COMMENT ON FUNCTION public.update_statistics_table IS 'Updates the statistics table with computed values from messages. Can be called manually or via scheduled job.';
COMMENT ON FUNCTION public.trigger_update_statistics IS 'Trigger function that updates statistics table automatically when messages are inserted.';
