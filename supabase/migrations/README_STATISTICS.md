# Statistics System - Real-time Computation

## Overview
This migration adds database functions to compute real-time statistics from the `messages` table, filtering only messages sent through the platform (by agents or AI).

## What was added

### 1. `get_user_statistics` Function
Computes statistics in real-time from the `messages` table for a given user and date range.

**Parameters:**
- `p_user_id` (UUID): User ID
- `p_from_date` (DATE): Start date
- `p_to_date` (DATE): End date (default: today)

**Returns:**
- `date`: Date of the statistics
- `messages_received`: Count of customer messages
- `messages_sent`: Count of platform messages (agent or AI-generated)
- `avg_response_time_seconds`: Average response time in seconds
- `active_contacts`: Number of unique conversations per day

**Filtering Logic:**
- Messages sent: `sender_type = 'agent'` OR `is_ai_generated = true`
- Messages received: `sender_type = 'customer'`
- Response time: Only considers responses within 1 hour to avoid outliers

### 2. `update_statistics_table` Function
Updates the `statistics` table with computed values. Can be called manually or via scheduled jobs.

**Parameters:**
- `p_user_id` (UUID, optional): Update for specific user or all users
- `p_from_date` (DATE, default: 7 days ago): Start date for computation

### 3. Auto-update Trigger
A trigger that automatically updates statistics when new messages are inserted.

## How to Apply

### Option 1: Supabase CLI (Recommended)
```bash
# Navigate to project directory
cd c:\Users\CASA\Desktop\whatsagenteai-2.0-main

# Apply migration
supabase db push

# Or if using migrations
supabase migration up
```

### Option 2: Supabase Dashboard
1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the content of `20251022000000_add_statistics_functions.sql`
4. Execute the SQL

### Option 3: Manual psql
```bash
psql -h your-project.supabase.co -U postgres -d postgres -f supabase/migrations/20251022000000_add_statistics_functions.sql
```

## Usage Examples

### Frontend (already implemented in Statistics.tsx)
```typescript
const { data, error } = await supabase.rpc('get_user_statistics', {
  p_user_id: user.id,
  p_from_date: '2025-10-15',
  p_to_date: '2025-10-22'
});
```

### Manually update statistics table
```sql
-- Update for all users (last 7 days)
SELECT public.update_statistics_table();

-- Update for specific user
SELECT public.update_statistics_table('user-uuid-here'::UUID);

-- Update for specific user and custom date range
SELECT public.update_statistics_table('user-uuid-here'::UUID, '2025-10-01'::DATE);
```

### Query statistics directly
```sql
-- Get statistics for a user
SELECT * FROM public.get_user_statistics(
  'user-uuid-here'::UUID,
  '2025-10-15'::DATE,
  '2025-10-22'::DATE
);
```

## Testing

### 1. Insert test messages
```sql
-- Insert a test conversation
INSERT INTO public.conversations (user_id, contact_phone, contact_name, last_message_at)
VALUES ('your-user-id'::UUID, '+5511999999999', 'Test Contact', NOW());

-- Insert customer message
INSERT INTO public.messages (conversation_id, user_id, content, sender_type)
VALUES (
  'conversation-id'::UUID,
  'your-user-id'::UUID,
  'Hello!',
  'customer'
);

-- Insert agent response (this will be counted in statistics)
INSERT INTO public.messages (conversation_id, user_id, content, sender_type, is_ai_generated)
VALUES (
  'conversation-id'::UUID,
  'your-user-id'::UUID,
  'How can I help you?',
  'agent',
  true
);
```

### 2. Check computed statistics
```sql
SELECT * FROM public.get_user_statistics(
  'your-user-id'::UUID,
  CURRENT_DATE - INTERVAL '7 days',
  CURRENT_DATE
);
```

### 3. Verify trigger
The trigger should automatically update the `statistics` table when messages are inserted. Check:
```sql
SELECT * FROM public.statistics 
WHERE user_id = 'your-user-id'::UUID 
ORDER BY date DESC 
LIMIT 7;
```

## Benefits

1. **Real-time data**: Statistics are computed from actual messages, not cached
2. **Platform-only metrics**: Only counts messages sent via platform (agent/AI)
3. **Automatic updates**: Trigger keeps statistics table updated
4. **Performance**: Indexed queries for fast computation
5. **Flexible**: Can query any date range on-demand

## Rollback

If you need to remove this migration:
```sql
-- Drop trigger
DROP TRIGGER IF EXISTS messages_update_statistics ON public.messages;

-- Drop functions
DROP FUNCTION IF EXISTS public.trigger_update_statistics();
DROP FUNCTION IF EXISTS public.update_statistics_table(UUID, DATE);
DROP FUNCTION IF EXISTS public.get_user_statistics(UUID, DATE, DATE);
```

## Notes

- The function filters messages where `sender_type = 'agent'` OR `is_ai_generated = true`
- Response time calculation only considers responses within 1 hour (3600 seconds)
- The trigger updates statistics for the current day when messages are inserted
- Statistics are computed per day (DATE granularity)
- All functions have `SECURITY DEFINER` to run with elevated privileges
