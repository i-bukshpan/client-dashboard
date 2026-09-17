-- ==============================================================================
-- Migration 050: Nehemiah OS v2 Autonomous Agent Scheduled Tasks
-- Allows Nehemiah to schedule recurring or one-off tasks for the AI agent:
-- e.g. morning email audits, daily calendar scans, reminder emails, client file audits.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.v2_agent_scheduled_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  instruction     TEXT NOT NULL,
  task_type       TEXT NOT NULL DEFAULT 'custom_prompt', -- 'check_emails', 'scan_calendar', 'send_email', 'audit_client', 'custom_prompt'
  schedule_type   TEXT NOT NULL CHECK (schedule_type IN ('daily', 'once', 'weekly', 'cron')),
  scheduled_time  TEXT, -- e.g. '08:30' for daily, or ISO string for once
  cron_expression TEXT,
  timezone        TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
  client_id       UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  last_run_status TEXT CHECK (last_run_status IN ('success', 'failed', 'running', null)),
  last_run_result JSONB DEFAULT '{}'::jsonb,
  next_run_at     TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_agent_scheduled_tasks_next_run
  ON public.v2_agent_scheduled_tasks(is_active, next_run_at)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_agent_scheduled_tasks_client_id
  ON public.v2_agent_scheduled_tasks(client_id);

CREATE INDEX IF NOT EXISTS idx_agent_scheduled_tasks_user_id
  ON public.v2_agent_scheduled_tasks(user_id);

-- Enable RLS
ALTER TABLE public.v2_agent_scheduled_tasks ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access on v2_agent_scheduled_tasks"
  ON public.v2_agent_scheduled_tasks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated workspace admins full access
CREATE POLICY "Admins full access on v2_agent_scheduled_tasks"
  ON public.v2_agent_scheduled_tasks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

GRANT ALL ON public.v2_agent_scheduled_tasks TO service_role;
