-- ============================================================
-- Migration 044 — Nehemiah OS v2: Cloud Chat Messages Persistence
-- ============================================================
-- Stores full chat conversation history per client in Supabase
-- to enable seamless cross-device synchronization (PC, Laptop, Mobile).
-- Accepts any valid string ID from @ai-sdk/react.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.v2_client_chat_messages (
  id               TEXT         PRIMARY KEY,
  client_id        UUID         NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  role             TEXT         NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content          TEXT,
  parts_json       JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Index for fast chronological loading per client
CREATE INDEX IF NOT EXISTS idx_v2_client_chat_messages_client_created
  ON public.v2_client_chat_messages (client_id, created_at ASC);

-- Permissions
GRANT ALL ON public.v2_client_chat_messages TO postgres, service_role, authenticated;

-- RLS
ALTER TABLE public.v2_client_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to v2_client_chat_messages" ON public.v2_client_chat_messages;
CREATE POLICY "Service role has full access to v2_client_chat_messages" ON public.v2_client_chat_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage client chat messages" ON public.v2_client_chat_messages;
CREATE POLICY "Authenticated users can manage client chat messages" ON public.v2_client_chat_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.v2_client_chat_messages IS
  'Stores multi-turn AI chat messages for each client for cloud synchronization across devices.';
