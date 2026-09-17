-- ==============================================================================
-- Migration 049: Nehemiah OS v3 Client Audio Recordings & Meeting Transcripts
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.v3_client_recordings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  drive_file_id   TEXT,
  duration_sec    INTEGER,
  transcript_text TEXT,
  transcript_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (transcript_status IN ('pending', 'processing', 'done', 'failed')),
  extracted_items JSONB NOT NULL DEFAULT '[]'::jsonb, -- tasks, decisions, amounts
  uploaded_by     UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_v3_recordings_client_id ON public.v3_client_recordings(client_id);
CREATE INDEX IF NOT EXISTS idx_v3_recordings_status ON public.v3_client_recordings(transcript_status);
CREATE INDEX IF NOT EXISTS idx_v3_recordings_created_at ON public.v3_client_recordings(created_at DESC);

-- Enable RLS
ALTER TABLE public.v3_client_recordings ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access on v3_client_recordings"
  ON public.v3_client_recordings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated workspace admins full access
CREATE POLICY "Admins full access on v3_client_recordings"
  ON public.v3_client_recordings
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

-- Explicit table permissions
GRANT ALL ON TABLE public.v3_client_recordings TO postgres, service_role, authenticated;

