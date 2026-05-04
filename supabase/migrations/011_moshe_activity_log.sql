-- Migration 011 — Moshe portal: project activity log

CREATE TABLE IF NOT EXISTS public.moshe_project_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES public.moshe_projects(id) ON DELETE CASCADE,
  actor       TEXT NOT NULL DEFAULT 'משה',
  action      TEXT NOT NULL,
  details     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moshe_logs_proj ON public.moshe_project_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_moshe_logs_time ON public.moshe_project_logs(created_at DESC);

ALTER TABLE public.moshe_project_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth all moshe_project_logs"
  ON public.moshe_project_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.moshe_project_logs TO anon, authenticated, service_role;
