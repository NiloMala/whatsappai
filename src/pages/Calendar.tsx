import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { eventService } from "@/services/eventService";

const locales = {
  'pt-BR': ptBR,
};

const messages = {
  allDay: 'Todo o dia',
  previous: 'Anterior',
  next: 'Próximo',
  today: 'Hoje',
  month: 'Mês',
  week: 'Semana',
  day: 'Dia',
  agenda: 'Agenda',
  date: 'Data',
  time: 'Hora',
  event: 'Evento',
  noEventsInRange: 'Não há eventos neste período.',
  showMore: (total: number) => `+ Ver mais ${total}`,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Custom formats to control how dates are shown across views (agenda/day headers)
const formats = {
  // Agenda view date (the per-item date label) - "Domingo 02/11/25"
  agendaDateFormat: (date: Date, culture: string, localizer: any) => {
    const s = localizer.format(date, "EEEE dd/MM/yy", culture);
    return s.charAt(0).toUpperCase() + s.slice(1);
  },
  // Week header format: short day name to prevent wrapping
  weekHeaderFormat: (date: Date, culture: string, localizer: any) => {
    const dayNumber = localizer.format(date, "dd", culture);
    const dayName = localizer.format(date, "EEE", culture); // Use short format (Dom, Seg, Ter)
    const capitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    return `${dayNumber} ${capitalized}`;
  },
  // Day header format: "Domingo 02/11/25" (formato completo com data)
  dayHeaderFormat: (date: Date, culture: string, localizer: any) => {
    const s = localizer.format(date, "EEEE dd/MM/yy", culture);
    return s.charAt(0).toUpperCase() + s.slice(1);
  },
};

interface Event {
  id: string;
  title: string;
  start: Date;
  end: Date;
}

const CalendarPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    console.log('Injecting calendar styles v2');
    // Improve calendar visibility and button styling
    const style = document.createElement('style');
    style.id = 'calendar-custom-styles-v2';
    style.textContent = `
      /* WEEK VIEW HEADER FIX - HIGHEST PRIORITY */
      .rbc-time-view.rbc-week-view .rbc-time-header table thead tr th.rbc-header,
      .rbc-time-view.rbc-week-view .rbc-time-header table thead tr th.rbc-header *,
      .rbc-time-view.rbc-week-view .rbc-time-header table thead tr th.rbc-header a,
      .rbc-time-view.rbc-week-view .rbc-time-header table thead tr th.rbc-header span,
      .rbc-time-view.rbc-week-view .rbc-time-header table thead tr th.rbc-header div {
        font-size: 11px !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: clip !important;
        text-transform: capitalize !important;
        line-height: 40px !important;
        height: 40px !important;
        padding: 0 2px !important;
        display: inline !important;
        text-align: center !important;
        vertical-align: middle !important;
      }

      /* Base sizing */
      .rbc-calendar { font-size: 16px !important; }
      .rbc-toolbar-label { font-size: 20px !important; font-weight: 700 !important; }

      /* Header / day names - for month/week/day views only (not agenda) */
      .rbc-month-view .rbc-header,
      .rbc-time-view .rbc-header,
      .rbc-week-view .rbc-header,
      .rbc-day-view .rbc-header {
        font-weight: 600 !important;
        padding: 12px 6px !important;
        font-size: 13px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        min-height: 50px !important;
        text-transform: capitalize !important;
      }
      .rbc-date-cell > a { display: block; padding: 4px 6px !important; font-size: 13px !important; font-weight: 600 !important; }

      /* Ensure month grid rows and cells maintain a consistent height */
      .rbc-month-view .rbc-row { min-height: 100px; }
      .rbc-month-view .rbc-row .rbc-date-cell { padding: 6px !important; height: 100px; }

      /* Add subtle borders between day cells to create a grid */
      .rbc-month-view .rbc-row .rbc-date-cell { border: 1px solid rgba(255,255,255,0.03); }
      /* Remove double outer border visual by slightly reducing opacity of outer container */
      .rbc-month-view { border-collapse: collapse; }

      /* Dim days that are outside the current month */
      .rbc-off-range, .rbc-off-range a { opacity: 0.45 !important; color: inherit !important; }

  /* Highlight today with a distinct background and prominent date */
  .today-highlight { background: hsl(142, 76%, 36%) !important; border-radius: 6px; position: relative !important; display: flex !important; flex-direction: column !important; justify-content: center !important; align-items: center !important; padding: 6px !important; }
  .rbc-today > a { color: #065f46 !important; font-weight: 800 !important; }

  /* Highlight today in week and day views - broaden selector coverage for react-big-calendar DOM
     Target header cells, date cells, day-bg and time grid column to ensure the green appears
     in month, week and day views. Using solid green for headers/date cells and a subtle
     tint for the time grid to keep events readable. */
  /* header/title cells */
  .rbc-week-view th.rbc-today,
  .rbc-day-view th.rbc-today,
  .rbc-week-view .rbc-header.rbc-today,
  .rbc-day-view .rbc-header.rbc-today {
    background: hsl(142, 76%, 36%) !important;
    color: white !important;
  }

  /* Center header text (date + weekday) in week/day views - same as month view */
  .rbc-time-view .rbc-header,
  .rbc-week-view .rbc-header,
  .rbc-day-view .rbc-header {
    font-weight: 600 !important;
    padding: 12px 6px !important;
    font-size: 13px !important;
    text-align: center !important;
    text-transform: capitalize !important;
    white-space: nowrap !important;
    min-height: 50px !important;
    vertical-align: middle !important;
  }
  .rbc-time-view .rbc-header a,
  .rbc-week-view .rbc-header a,
  .rbc-day-view .rbc-header a {
    display: block !important;
    width: 100% !important;
    text-align: center !important;
    text-transform: capitalize !important;
    white-space: nowrap !important;
  }

  /* Remove thin line / border under the weekday headers in week/day (time) views */
  /* react-big-calendar renders header rows with table borders; override them here */
  .rbc-time-view .rbc-time-header,
  .rbc-time-view .rbc-time-header table thead th,
  .rbc-time-view .rbc-header,
  .rbc-week-view .rbc-header,
  .rbc-day-view .rbc-header {
    border-bottom: none !important;
    box-shadow: none !important;
  }
  /* Also remove any subtle bottom border on the inner header link element */
  .rbc-time-view .rbc-header a,
  .rbc-week-view .rbc-header a,
  .rbc-day-view .rbc-header a {
    border-bottom: none !important;
  }

  /* Simpler table header cells - same pattern as month view, no flexbox */
  .rbc-time-header table thead tr th.rbc-header,
  .rbc-time-header table thead tr th.rbc-header > div,
  .rbc-time-view .rbc-time-header table thead tr th.rbc-header,
  .rbc-week-view .rbc-time-header table thead tr th.rbc-header {
    font-weight: 600 !important;
    padding: 8px 2px !important;
    font-size: 11px !important;
    text-align: center !important;
    vertical-align: middle !important;
    text-transform: capitalize !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: clip !important;
    height: 40px !important;
    line-height: 40px !important;
    box-sizing: border-box !important;
  }

  /* Links inside header cells */
  .rbc-time-header table thead tr th.rbc-header a,
  .rbc-time-header table thead tr th.rbc-header span,
  .rbc-time-header table thead tr th.rbc-header div,
  .rbc-time-view .rbc-header a {
    display: inline !important;
    width: auto !important;
    text-align: center !important;
    text-transform: capitalize !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    line-height: 40px !important;
  }

  /* --- Day view: remove leftover horizontal divider/empty line under header --- */
  /* Target the day view-specific header table and any gutter lines */
  .rbc-day-view .rbc-time-header,
  .rbc-day-view .rbc-time-header table,
  .rbc-day-view .rbc-time-header table thead,
  .rbc-day-view .rbc-time-header table thead tr,
  .rbc-day-view .rbc-time-header table thead tr th,
  .rbc-day-view .rbc-time-header table thead tr th.rbc-header {
    border-bottom: none !important;
    box-shadow: none !important;
  }

  /* Remove any thin borders on the time gutter or time-slot separators that
     may appear as a horizontal line at the top of the day view. */
  .rbc-day-view .rbc-time-gutter,
  .rbc-day-view .rbc-time-gutter .rbc-timeslot,
  .rbc-day-view .rbc-time-content .rbc-day-bg {
    border: none !important;
    border-top: none !important;
    box-shadow: none !important;
  }

  /* If a theme applies a top border to the wrapper row, remove it here */
  .rbc-day-view .rbc-time-view > .rbc-time-header {
    border-top: none !important;
  }

  /* Do not tint the hourly grid — only highlight the header and all-day row
     for today to match the month view without changing the time-slot grid. */

  /* also ensure the all-day row (if present) uses the green background for today */
  .rbc-allday-cell.rbc-today,
  .rbc-allday-slot .rbc-today {
    background: rgba(16,185,129,0.22) !important;
  }
  /* Keep time-grid (hour rows) unchanged so the column does not become
     striped — only header and all-day row are highlighted for today. */

  /* Badge styling and centering */
  .custom-day-badge { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: inline-flex; align-items: center; justify-content: center; background-color: #10B981; color: #fff; width: 28px; height: 28px; border-radius: 9999px; font-size: 12px; font-weight: 700; z-index: 10; }

  /* Center event text vertically inside event bars (day/week views) */
  /* Allow react-big-calendar to control the event element height so duration
     is rendered correctly (1h = 1 row, 30m = half row). Do NOT override
     the inline height that rbc sets. Only adjust horizontal padding and
     vertical alignment. */
  .rbc-event, .rbc-event-continuer, .rbc-event-continuer-left, .rbc-event-continuer-right {
    display: flex !important;
    align-items: center !important;
    padding-left: 6px !important;
    padding-right: 6px !important;
    /* IMPORTANT: do not set height here; rbc sets inline heights based on duration */
  }
  .rbc-event .rbc-event-content, .rbc-event-content {
    display: flex !important;
    align-items: center !important;
    width: 100% !important;
    line-height: 1 !important;
    padding: 6px 8px !important;
    box-sizing: border-box !important;
  }
  /* Keep event time and title on the same line; truncate overflow with ellipsis */
  .rbc-event-content, .rbc-event-content * {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  /* Ensure the small time label doesn't force a wrap; keep some spacing */
  /* Hide react-big-calendar's default inline time/label in time views when using our custom event renderer
     to avoid duplicated time text. We'll render the time via .custom-inline-event-time instead. */
  .rbc-time-view .rbc-event .rbc-event-label,
  .rbc-time-view .rbc-event .rbc-event-time,
  .rbc-week-view .rbc-event .rbc-event-label,
  .rbc-week-view .rbc-event .rbc-event-time,
  .rbc-day-view .rbc-event .rbc-event-label,
  .rbc-day-view .rbc-event .rbc-event-time {
    display: none !important;
  }
  /* custom inline event component styles */
  .custom-inline-event { display: flex !important; align-items: center !important; gap: 8px !important; width: 100% !important; }
  .custom-inline-event-time { flex: 0 0 auto !important; font-size: 12px !important; opacity: 0.95 !important; }
  .custom-inline-event-title { flex: 1 1 auto !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
  /* Ensure time and title use the same font metrics so they align vertically */
  .rbc-time-view .custom-inline-event-time,
  .rbc-time-view .custom-inline-event-title,
  .rbc-week-view .custom-inline-event-time,
  .rbc-week-view .custom-inline-event-title,
  .rbc-day-view .custom-inline-event-time,
  .rbc-day-view .custom-inline-event-title {
    font-size: 13px !important;
    line-height: 18px !important;
    font-family: inherit !important;
    font-weight: 500 !important;
  }

      /* Toolbar buttons appearance */
      .rbc-toolbar button {
        background: white !important;
        color: #374151 !important;
        border: 1px solid #d1d5db !important;
        border-radius: 8px !important;
        padding: 8px 16px !important;
        font-weight: 500 !important;
        transition: all 0.12s ease !important;
      }
      .rbc-toolbar button:hover { background: #f9fafb !important; border-color: #9ca3af !important; }
      .rbc-toolbar button.rbc-active { background: #374151 !important; color: white !important; border-color: #374151 !important; }

      /* Keep day numbers left/top aligned and cells visually separated */
      .rbc-date-cell { box-sizing: border-box; }
      .rbc-row-segment { padding: 6px 8px !important; }

      /* Fix time grid alignment - remove padding/margin that causes indentation */
      .rbc-time-content { margin: 0 !important; padding: 0 !important; }
      .rbc-time-column { margin: 0 !important; padding: 0 !important; }
      .rbc-day-slot { margin: 0 !important; }
      .rbc-timeslot-group { margin: 0 !important; padding: 0 !important; }
      .rbc-time-header-content { margin: 0 !important; padding: 0 !important; }

      /* Fix header columns alignment - ensure all columns have equal width */
      .rbc-time-header-content .rbc-row {
        margin: 0 !important;
        padding: 0 !important;
      }

      .rbc-time-header-content .rbc-header {
        margin: 0 !important;
        padding: 0 6px !important;
        box-sizing: border-box !important;
      }

      /* Ensure all header cells are same width */
      .rbc-time-header table {
        table-layout: fixed !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      .rbc-time-header table thead tr th.rbc-header {
        width: auto !important;
        box-sizing: border-box !important;
      }

      /* Ensure time gutter and content align perfectly */
      .rbc-time-view .rbc-time-gutter { border-right: 1px solid rgba(255,255,255,0.06) !important; }
      .rbc-time-view .rbc-time-content > * + * > * { border-left: 1px solid rgba(255,255,255,0.06) !important; }

      /* Centralize all weekday header text in time views (week/day only, not agenda) */
      .rbc-time-view .rbc-header,
      .rbc-week-view .rbc-header,
      .rbc-day-view .rbc-header {
        vertical-align: middle !important;
      }

      .rbc-time-header-content .rbc-header,
      .rbc-time-header table thead tr th {
        vertical-align: middle !important;
        text-align: center !important;
      }

      /* Force week view headers to single line with smaller font */
      .rbc-week-view .rbc-time-header table thead tr th.rbc-header,
      .rbc-week-view .rbc-time-header table thead tr th.rbc-header *,
      .rbc-week-view .rbc-time-header table thead tr th.rbc-header a,
      .rbc-week-view .rbc-time-header table thead tr th.rbc-header span,
      .rbc-week-view .rbc-time-header table thead tr th.rbc-header div {
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: clip !important;
        display: inline !important;
        line-height: 40px !important;
        font-size: 11px !important;
      }

      /* Agenda view: simple table layout without extra formatting */
      .rbc-agenda-view .rbc-header {
        display: table-cell !important;
        padding: 8px !important;
        font-weight: 600 !important;
        min-height: auto !important;
        height: auto !important;
        vertical-align: middle !important;
        text-align: left !important;
      }

      /* Remove any flex behavior from agenda headers */
      .rbc-agenda-view th.rbc-header {
        display: table-cell !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Ensure agenda table shows full grid borders in Agenda view
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Agenda view: table grid lines */
      .rbc-agenda-view .rbc-agenda-content table,
      .rbc-agenda-view .rbc-agenda-content table th,
      .rbc-agenda-view .rbc-agenda-content table td,
      .rbc-agenda-table,
      .rbc-agenda-table th,
      .rbc-agenda-table td {
        border: 1px solid rgba(255,255,255,0.06) !important;
        border-collapse: collapse !important;
        padding: 8px !important;
      }
      .rbc-agenda-view .rbc-agenda-content table { width: 100% !important; }
    `;
    document.head.appendChild(style);

    return () => { document.head.removeChild(style); };
  }, []);

  // Custom renderer for events in week/day views to keep time and title
  // on a single line. react-big-calendar allows passing a component via
  // the `components` prop named `event`.
  const EventComponent = ({ event }: any) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const timeLabel = `${start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    // Show event title in parentheses after the time range, e.g. "15:00 – 15:30 (Novo)"
    const display = `${timeLabel} (${event.title})`;
    return (
      <div className="custom-inline-event" title={display}>
        <span className="custom-inline-event-time">{timeLabel}</span>
        <span className="custom-inline-event-title">({event.title})</span>
      </div>
    );
  };

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'month' | 'week' | 'day'>('month');

  const fetchEvents = async (start: Date, end: Date) => {
    try {
      setLoading(true);
      // Normalize range: expand start to start-of-day and end to end-of-day
      // to ensure RPC receives a full-day inclusive range. This avoids
      // off-by-one issues where end timestamps at 00:00:00 exclude events
      // occurring on that final date.
      const queryStart = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
      const queryEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
      console.log('Calendar.fetchEvents called', { start: start?.toISOString(), end: end?.toISOString(), queryStart: queryStart?.toISOString(), queryEnd: queryEnd?.toISOString(), currentView });
      const { data: user } = await supabase.auth.getUser();
      if (user.user) {
        const data = await eventService.getEventsInRange(user.user.id, queryStart, queryEnd);
        const formatted = data.map(ev => ({
          id: ev.id,
          title: ev.title,
          start: new Date(ev.start_time),
          end: new Date(ev.end_time),
        }));
        console.log('Calendar.fetchEvents got', formatted.length, formatted);
        setEvents(formatted);
      } else {
        setEvents([]);
      }
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    fetchEvents(start, end);
  }, []);

  // Debug: log events when they change so we can verify start/end values
  useEffect(() => {
    try {
      console.log('Calendar: events state updated, count=', events.length, events);
    } catch (e) {
      // ignore
    }
  }, [events]);

  // NOTE: previous attempts to programmatically apply inline styles caused
  // repeated DOM mutations and blocked rendering. We'll rely on the injected
  // CSS above to style the today cell across views. If needed we can re-add
  // a safe observer later that does not update React state from the
  // mutation callback.

  const handleSelectSlot = (slotInfo: { start: Date }) => {
    // Criar a data em UTC para evitar problemas de timezone
    const utcDate = new Date(Date.UTC(
      slotInfo.start.getFullYear(),
      slotInfo.start.getMonth(),
      slotInfo.start.getDate()
    ));

    const dateString = utcDate.toISOString().split('T')[0];
    navigate(`/dashboard/calendar/${dateString}`);
  };

  // navigate when clicking an event in month view
  const handleSelectEvent = (event: Event) => {
    const dateString = event.start.toISOString().split('T')[0];
    navigate(`/dashboard/calendar/${dateString}`);
  };

  // Helper to check same calendar day
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  // Custom wrapper to render a compact badge with count of events for the date
  const DateCellWrapper = ({ children, value }: any) => {
    const count = events.filter((ev) => sameDay(ev.start, value)).length;
    const isToday = sameDay(value, new Date());
    const onClick = () => {
      const utcDate = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
      const dateString = utcDate.toISOString().split('T')[0];
      navigate(`/dashboard/calendar/${dateString}`);
    };

    return (
      <div 
        onClick={onClick} 
        className={`cursor-pointer relative ${isToday ? 'today-highlight' : ''}`} 
        style={{ width: '100%', height: '100%' }}
      >
        {children}
        {count > 0 && (
          // small centered badge with only the number of events
          <span className="custom-day-badge">
            {count}
          </span>
        )}
      </div>
    );
  };

  // Ensure week/day views highlight today's column via prop getters
  const dayPropGetter = (date: Date) => {
    if (sameDay(date, new Date())) {
      return { style: { background: 'hsl(142, 76%, 36%)', color: 'white' } };
    }
    return {};
  };

  // For time slots, add a subtle tint for today's column
  const slotPropGetter = (date: Date) => {
    // Do not color each slot individually to avoid striped look; the
    // `.rbc-day-bg.rbc-today` CSS handles the full-column background.
    return {};
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Agenda</h1>
          <p className="text-muted-foreground">
            Gerencie seus eventos e compromissos
          </p>
        </div>

        <div className="bg-card rounded-lg shadow border">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold mb-2">Calendário</h2>
            <p className="text-muted-foreground">Selecione uma data para ver a agenda</p>
          </div>
          <div className="p-6">
            {/* ...existing code... */}
            {
              // choose components per view: in month view we use DateCellWrapper,
              // otherwise use a custom EventComponent so we control layout of
              // time + title in the event bar (keeps them on one line like Google Calendar)
            }
            <Calendar
              localizer={localizer}
              formats={formats}
              events={events} // show real events
              startAccessor="start"
              endAccessor="end"
              style={{ height: currentView === 'month' ? 500 : 600, fontSize: '16px' }}
              culture="pt-BR"
              messages={messages}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              onRangeChange={(range) => {
                // react-big-calendar can pass different shapes for range depending
                // on the current view: an array of dates (month), or an object
                // with { start, end } for week/day. Handle both so events are
                // fetched correctly when switching views.
                try {
                  if (Array.isArray(range) && range.length > 0) {
                    fetchEvents(new Date(range[0] as any), new Date(range[range.length - 1] as any));
                  } else if (range && typeof range === 'object' && 'start' in range && 'end' in range) {
                    // some views pass an object { start, end }
                    fetchEvents(new Date((range as any).start), new Date((range as any).end));
                  } else if (range instanceof Date) {
                    fetchEvents(range, range);
                  } else {
                    // fallback: attempt to coerce if it's an iterable
                    try {
                      const arr = Array.from(range as any);
                      if (arr.length > 0) fetchEvents(new Date(arr[0] as any), new Date(arr[arr.length - 1] as any));
                    } catch (e) {
                      // ignore
                    }
                  }
                } catch (err) {
                  console.error('Error handling onRangeChange:', err);
                }
              }}
              onView={(view) => setCurrentView(view as 'month' | 'week' | 'day')}
              view={currentView}
              selectable
              defaultView="month"
              dayPropGetter={dayPropGetter}
              slotPropGetter={slotPropGetter}
              // Hide individual event tiles only in month view, show in week/day views
              eventPropGetter={() => currentView === 'month' ? { style: { display: 'none' } } : {}}
              components={currentView === 'month' ? { dateCellWrapper: DateCellWrapper } : { event: EventComponent }}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CalendarPage;