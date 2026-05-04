-- Migration 010 — Moshe portal: drive link + documents per project

-- Add drive folder URL to projects
ALTER TABLE public.moshe_projects
  ADD COLUMN IF NOT EXISTS drive_folder_url TEXT;

-- Documents table per project
CREATE TABLE IF NOT EXISTS public.moshe_project_documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES public.moshe_projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moshe_docs_proj ON public.moshe_project_documents(project_id);

ALTER TABLE public.moshe_project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth all moshe_project_documents"
  ON public.moshe_project_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.moshe_project_documents TO anon, authenticated, service_role;
