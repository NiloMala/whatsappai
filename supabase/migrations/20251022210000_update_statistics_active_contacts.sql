-- Migration: Update statistics to count unique customers served
-- Created: 2025-10-22
-- Purpose: Count active contacts from conversations table instead of conversation_id

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
      COUNT(CASE WHEN m.sender_type = 'agent' OR m.is_ai_generated = true THEN 1 END)::INTEGER as sent
    FROM public.messages m
    WHERE m.user_id = p_user_id
      AND DATE(m.created_at) >= p_from_date
      AND DATE(m.created_at) <= p_to_date
    GROUP BY DATE(m.created_at)
  ),
  unique_contacts AS (
    -- Count unique customers served per day from conversations table
    SELECT
      DATE(c.updated_at) as stat_date,
      COUNT(DISTINCT c.contact_phone)::INTEGER as contacts
    FROM public.conversations c
    WHERE c.user_id = p_user_id
      AND DATE(c.updated_at) >= p_from_date
      AND DATE(c.updated_at) <= p_to_date
    GROUP BY DATE(c.updated_at)
  ),
  response_times AS (
    -- Calculate average response time between customer message and agent response
    SELECT
      DATE(customer_msg.created_at) as stat_date,
      AVG(
        EXTRACT(EPOCH FROM (agent_msg.created_at - customer_msg.created_at))
      )::INTEGER as avg_response
    FROM public.messages customer_msg
    INNER JOIN LATERAL (
      SELECT created_at
      FROM public.messages
      WHERE user_id = customer_msg.user_id
        AND sender_type = 'agent'
        AND created_at > customer_msg.created_at
        AND DATE(created_at) >= p_from_date
        AND DATE(created_at) <= p_to_date
      ORDER BY created_at ASC
      LIMIT 1
    ) agent_msg ON true
    WHERE customer_msg.user_id = p_user_id
      AND customer_msg.sender_type = 'customer'
      AND DATE(customer_msg.created_at) >= p_from_date
      AND DATE(customer_msg.created_at) <= p_to_date
      -- Only consider responses within 1 hour (3600 seconds) to avoid outliers
      AND EXTRACT(EPOCH FROM (agent_msg.created_at - customer_msg.created_at)) <= 3600
      AND EXTRACT(EPOCH FROM (agent_msg.created_at - customer_msg.created_at)) > 0
    GROUP BY DATE(customer_msg.created_at)
  )
  SELECT
    COALESCE(ds.stat_date, uc.stat_date) as date,
    COALESCE(ds.received, 0)::INTEGER as messages_received,
    COALESCE(ds.sent, 0)::INTEGER as messages_sent,
    COALESCE(rt.avg_response, 0)::INTEGER as avg_response_time_seconds,
    COALESCE(uc.contacts, 0)::INTEGER as active_contacts
  FROM daily_stats ds
  FULL OUTER JOIN unique_contacts uc ON uc.stat_date = ds.stat_date
  LEFT JOIN response_times rt ON rt.stat_date = COALESCE(ds.stat_date, uc.stat_date)
  WHERE COALESCE(ds.stat_date, uc.stat_date) IS NOT NULL
  ORDER BY COALESCE(ds.stat_date, uc.stat_date) ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_statistics(UUID, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION public.get_user_statistics IS 'Computes real-time statistics from messages and conversations tables. Active contacts counted from unique contact_phone in conversations table.';
