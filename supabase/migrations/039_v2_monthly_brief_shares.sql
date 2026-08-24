-- Immutable public Monthly Brief share grants.
-- Brief content remains in the client's Google Drive; Supabase stores token/file metadata only.

CREATE TABLE IF NOT EXISTS public.v2_monthly_brief_share_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  brief_id TEXT NOT NULL,
  report_month TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  snapshot_file_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_viewed_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_v2_monthly_brief_shares_client
  ON public.v2_monthly_brief_share_grants (client_id, report_month, created_at DESC);

ALTER TABLE public.v2_monthly_brief_share_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_monthly_brief_shares_admin_all" ON public.v2_monthly_brief_share_grants
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT ALL ON public.v2_monthly_brief_share_grants TO service_role;
