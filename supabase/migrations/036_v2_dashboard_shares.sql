-- Nehemiah OS v2 immutable dashboard sharing metadata.
-- Snapshot bodies and PDFs remain in Google Drive; Supabase stores grants and file IDs only.

CREATE TABLE IF NOT EXISTS public.v2_dashboard_share_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  snapshot_file_id TEXT NOT NULL,
  pdf_file_id TEXT,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_viewed_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_v2_dashboard_shares_client
  ON public.v2_dashboard_share_grants (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v2_dashboard_shares_active
  ON public.v2_dashboard_share_grants (token_hash)
  WHERE revoked_at IS NULL;

ALTER TABLE public.v2_dashboard_share_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_dashboard_shares_admin_all"
  ON public.v2_dashboard_share_grants FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT ALL ON public.v2_dashboard_share_grants TO service_role;
