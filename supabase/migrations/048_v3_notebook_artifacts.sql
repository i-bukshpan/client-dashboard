-- ==============================================================================
-- Migration 048: Nehemiah OS v3 Notebook Artifacts (Studio Repository)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.v3_notebook_artifacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID REFERENCES public.clients(id) ON DELETE CASCADE, -- NULL indicates global agency artifact
  artifact_type TEXT NOT NULL CHECK (artifact_type IN (
    'card', 'brief', 'chart', 'action_plan', 'table', 'meeting_prep'
  )),
  title         TEXT NOT NULL,
  content_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_md    TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_pinned     BOOLEAN NOT NULL DEFAULT false,
  share_token   TEXT UNIQUE,
  share_expires TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_v3_artifacts_client_id ON public.v3_notebook_artifacts(client_id);
CREATE INDEX IF NOT EXISTS idx_v3_artifacts_type ON public.v3_notebook_artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS idx_v3_artifacts_is_pinned ON public.v3_notebook_artifacts(is_pinned);
CREATE INDEX IF NOT EXISTS idx_v3_artifacts_share_token ON public.v3_notebook_artifacts(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_v3_artifacts_created_at ON public.v3_notebook_artifacts(created_at DESC);

-- Enable RLS
ALTER TABLE public.v3_notebook_artifacts ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access on v3_notebook_artifacts"
  ON public.v3_notebook_artifacts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated workspace admins full access
CREATE POLICY "Admins full access on v3_notebook_artifacts"
  ON public.v3_notebook_artifacts
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

-- Public read-only access for valid unexpired share tokens
CREATE POLICY "Public read shared artifacts via token"
  ON public.v3_notebook_artifacts
  FOR SELECT
  TO anon
  USING (
    share_token IS NOT NULL
    AND (share_expires IS NULL OR share_expires > now())
  );

-- Explicit table permissions
GRANT ALL ON TABLE public.v3_notebook_artifacts TO postgres, service_role, authenticated;
GRANT SELECT ON TABLE public.v3_notebook_artifacts TO anon;

