-- Migration: Add schedule configuration and holidays tables for agents
-- Description: Allows users to configure custom scheduling hours and holidays per agent

-- Create agent_schedule_config table
CREATE TABLE IF NOT EXISTS public.agent_schedule_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,

  -- Enable/disable scheduling feature
  scheduling_enabled BOOLEAN DEFAULT false,

  -- Days of the week (0=Sunday, 1=Monday, ..., 6=Saturday)
  monday BOOLEAN DEFAULT true,
  tuesday BOOLEAN DEFAULT true,
  wednesday BOOLEAN DEFAULT true,
  thursday BOOLEAN DEFAULT true,
  friday BOOLEAN DEFAULT true,
  saturday BOOLEAN DEFAULT false,
  sunday BOOLEAN DEFAULT false,

  -- Business hours
  start_time TIME DEFAULT '08:00:00',
  end_time TIME DEFAULT '17:00:00',

  -- Appointment configuration
  slot_duration INTEGER DEFAULT 60, -- Duration in minutes (30, 60, 90, 120, etc)
  allow_partial_hours BOOLEAN DEFAULT false, -- Allow times like 9:30, 10:15 (if false, only full hours)

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- One config per agent
  UNIQUE(agent_id)
);

-- Create agent_holidays table (blocked dates)
CREATE TABLE IF NOT EXISTS public.agent_holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  holiday_date DATE NOT NULL,
  description TEXT, -- e.g., "Christmas", "Vacation", "Training"

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- One holiday per date per agent
  UNIQUE(agent_id, holiday_date)
);

-- Enable Row Level Security
ALTER TABLE public.agent_schedule_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_holidays ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_schedule_config
CREATE POLICY "Users can view their own schedule configs"
  ON public.agent_schedule_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own schedule configs"
  ON public.agent_schedule_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own schedule configs"
  ON public.agent_schedule_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own schedule configs"
  ON public.agent_schedule_config FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for agent_holidays
CREATE POLICY "Users can view their own holidays"
  ON public.agent_holidays FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own holidays"
  ON public.agent_holidays FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own holidays"
  ON public.agent_holidays FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own holidays"
  ON public.agent_holidays FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_agent_schedule_config_agent_id ON public.agent_schedule_config(agent_id);
CREATE INDEX idx_agent_schedule_config_user_id ON public.agent_schedule_config(user_id);
CREATE INDEX idx_agent_holidays_agent_id ON public.agent_holidays(agent_id);
CREATE INDEX idx_agent_holidays_date ON public.agent_holidays(holiday_date);

-- Add comment for documentation
COMMENT ON TABLE public.agent_schedule_config IS 'Stores custom scheduling configuration for each agent (business hours, days, intervals)';
COMMENT ON TABLE public.agent_holidays IS 'Stores blocked dates (holidays, vacations) for each agent';
