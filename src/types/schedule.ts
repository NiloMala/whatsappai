// Types for agent scheduling configuration

export interface ScheduleConfig {
  scheduling_enabled: boolean;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  start_time: string; // Format: "HH:MM" (e.g., "08:00")
  end_time: string;   // Format: "HH:MM" (e.g., "17:00")
  slot_duration: number; // Minutes: 30, 60, 90, 120
  allow_partial_hours: boolean;
  event_type?: string; // Default event type (e.g., "Consulta", "Reunião", "Atendimento")
}

export interface Holiday {
  id?: string;
  date: string; // Format: "YYYY-MM-DD"
  description: string;
}

export interface AgentScheduleConfig extends ScheduleConfig {
  id?: string;
  user_id?: string;
  agent_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AgentHoliday extends Holiday {
  agent_id?: string;
  user_id?: string;
  created_at?: string;
}

// Default configuration (Monday-Friday, 8:00-17:00, 1-hour slots)
export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  scheduling_enabled: false,
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false,
  start_time: '08:00',
  end_time: '17:00',
  slot_duration: 60,
  allow_partial_hours: false,
  event_type: 'Consulta',
};

// Slot duration options for select dropdown
export const SLOT_DURATION_OPTIONS = [
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1 hora e 30 minutos' },
  { value: 120, label: '2 horas' },
];

// Delivery estimated time options (ranges in minutes)
export const DELIVERY_TIME_OPTIONS = [
  { value: 22, label: '15 a 30 minutos' },  // média: 22.5
  { value: 37, label: '30 a 45 minutos' },  // média: 37.5
  { value: 52, label: '45 a 60 minutos' },  // média: 52.5
  { value: 67, label: '60 a 75 minutos' },  // média: 67.5
  { value: 82, label: '75 a 90 minutos' },  // média: 82.5
];

// Event type options for calendar events
export const EVENT_TYPE_OPTIONS = [
  { value: 'Consulta', label: 'Consulta' },
  { value: 'Reunião', label: 'Reunião' },
  { value: 'Atendimento', label: 'Atendimento' },
  { value: 'Visita', label: 'Visita' },
  { value: 'Sessão', label: 'Sessão' },
  { value: 'Compromisso', label: 'Compromisso' },
];

// Days of the week
export const WEEK_DAYS = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terça' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
] as const;
