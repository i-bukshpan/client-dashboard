-- ============================================================
-- Migration 046 — Nehemiah OS v2: Security & RLS Hardening
-- ============================================================
-- Hardens Row Level Security on all v2 tables.
-- Restricts sensitive agent memories, chat histories, confirmations
-- and job queues to administrators only (public.is_admin()) and service_role.
-- ============================================================

-- 1. v2_agent_memories hardening
ALTER TABLE public.v2_agent_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage client memories" ON public.v2_agent_memories;
DROP POLICY IF EXISTS "Service role has full access to v2_agent_memories" ON public.v2_agent_memories;
DROP POLICY IF EXISTS "v2_agent_memories_admin_all" ON public.v2_agent_memories;

CREATE POLICY "v2_agent_memories_service_role" ON public.v2_agent_memories
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "v2_agent_memories_admin_all" ON public.v2_agent_memories
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 2. v2_client_chat_messages hardening
ALTER TABLE public.v2_client_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage client chat messages" ON public.v2_client_chat_messages;
DROP POLICY IF EXISTS "Service role has full access to v2_client_chat_messages" ON public.v2_client_chat_messages;
DROP POLICY IF EXISTS "v2_client_chat_messages_admin_all" ON public.v2_client_chat_messages;

CREATE POLICY "v2_client_chat_messages_service_role" ON public.v2_client_chat_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "v2_client_chat_messages_admin_all" ON public.v2_client_chat_messages
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. v2_agent_confirmations hardening
ALTER TABLE public.v2_agent_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "v2_agent_confirmations_service_role" ON public.v2_agent_confirmations;
DROP POLICY IF EXISTS "v2_agent_confirmations_admin_all" ON public.v2_agent_confirmations;

CREATE POLICY "v2_agent_confirmations_service_role" ON public.v2_agent_confirmations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "v2_agent_confirmations_admin_all" ON public.v2_agent_confirmations
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. v2_job_outbox hardening
ALTER TABLE public.v2_job_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "v2_job_outbox_service_role" ON public.v2_job_outbox;
DROP POLICY IF EXISTS "v2_job_outbox_admin_all" ON public.v2_job_outbox;

CREATE POLICY "v2_job_outbox_service_role" ON public.v2_job_outbox
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "v2_job_outbox_admin_all" ON public.v2_job_outbox
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.v2_agent_memories IS 'Protected v2 client memories — restricted to Nehemiah OS admin only.';
COMMENT ON TABLE public.v2_client_chat_messages IS 'Protected v2 chat messages — restricted to Nehemiah OS admin only.';
