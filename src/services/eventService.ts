import { supabase } from '@/integrations/supabase/client';
import { Event } from '@/types/events';

export const eventService = {
  getEventsForDate: async (userId: string, date: Date) => {
    // Use server-side function to avoid timezone and RLS edge-cases.
    // The DB function `get_events_for_date(p_user_id UUID, p_date DATE)`
    // returns events where DATE(start_time) = p_date.
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

    const { data, error } = await supabase
      .rpc('get_events_for_date', { p_user_id: userId, p_date: dateStr });

    if (error) {
      console.error('Erro na RPC get_events_for_date:', error);
      // Fallback: return empty array instead of throwing so UI can continue
      return [];
    }

    // The RPC returns rows matching Event shape
    return (data as Event[]) || [];
  },

  getEventsInRange: async (userId: string, start: Date, end: Date) => {
    // Use server-side function to get events in date range.
    // The DB function expects TIMESTAMPTZ values; pass full ISO timestamps
    // (including time) so the range comparison works correctly for events
    // that have specific start/end times.
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    try {
      console.log('[eventService] getEventsInRange called', { userId, startIso, endIso });
      const { data, error } = await supabase
        .rpc('get_events_in_range', { p_user_id: userId, p_start_date: startIso, p_end_date: endIso });

      if (error) {
        console.error('Erro na RPC get_events_in_range:', error);
        return [];
      }

      console.log('[eventService] getEventsInRange result count=', Array.isArray(data) ? data.length : 0, data);
      return (data as Event[]) || [];
    } catch (err) {
      console.error('[eventService] unexpected error in getEventsInRange', err);
      return [];
    }
  },

  createEvent: async (event: Omit<Event, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('events')
      .insert(event)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateEvent: async (id: string, updates: Partial<Event>) => {
    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  deleteEvent: async (id: string) => {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};