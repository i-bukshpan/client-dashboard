-- ==============================================================================
-- Migration 051: Nehemiah OS v3 Chat Sessions & Daily Brief DB Persistence
-- 1. Dedicated public.v2_daily_brief_cache table for morning auto-overwrites & fast DB caching.
-- 2. Dedicated public.v3_chat_sessions table for resilient multi-session persistence (client & global).
-- 3. Make client_id nullable on v2_client_chat_messages to support global workspace chats.
-- ==============================================================================

-- 1. Daily Brief Cache Table
CREATE TABLE IF NOT EXISTS public.v2_daily_brief_cache (
  date_key    TEXT PRIMARY KEY, -- 'YYYY-MM-DD' in Asia/Jerusalem
  brief_json  JSONB NOT NULL,
  ai_summary  TEXT,
  stats_json  JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on created_at for cleanup
CREATE INDEX IF NOT EXISTS idx_v2_daily_brief_cache_created
  ON public.v2_daily_brief_cache(created_at DESC);

-- RLS & Grants for Daily Brief Cache
ALTER TABLE public.v2_daily_brief_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on v2_daily_brief_cache" ON public.v2_daily_brief_cache;
CREATE POLICY "Service role full access on v2_daily_brief_cache"
  ON public.v2_daily_brief_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins full access on v2_daily_brief_cache" ON public.v2_daily_brief_cache;
CREATE POLICY "Admins full access on v2_daily_brief_cache"
  ON public.v2_daily_brief_cache
  FOR ALL TO authenticated
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

GRANT ALL ON public.v2_daily_brief_cache TO postgres, service_role, authenticated;


-- 2. Multi-Session Chat Persistence Table (v3_chat_sessions)
CREATE TABLE IF NOT EXISTS public.v3_chat_sessions (
  id            TEXT PRIMARY KEY, -- e.g. 'sess_1726590823_xyz'
  client_id     UUID REFERENCES public.clients(id) ON DELETE CASCADE, -- NULL for global workspace
  title         TEXT NOT NULL DEFAULT 'שיחה חדשה',
  messages_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_v3_chat_sessions_client_updated
  ON public.v3_chat_sessions(client_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_v3_chat_sessions_global_updated
  ON public.v3_chat_sessions(updated_at DESC)
  WHERE client_id IS NULL;

-- RLS & Grants for Chat Sessions
ALTER TABLE public.v3_chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on v3_chat_sessions" ON public.v3_chat_sessions;
CREATE POLICY "Service role full access on v3_chat_sessions"
  ON public.v3_chat_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins full access on v3_chat_sessions" ON public.v3_chat_sessions;
CREATE POLICY "Admins full access on v3_chat_sessions"
  ON public.v3_chat_sessions
  FOR ALL TO authenticated
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

GRANT ALL ON public.v3_chat_sessions TO postgres, service_role, authenticated;


-- 3. Relax client_id NOT NULL constraint on legacy v2_client_chat_messages
DO $$
BEGIN
  ALTER TABLE public.v2_client_chat_messages ALTER COLUMN client_id DROP NOT NULL;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
