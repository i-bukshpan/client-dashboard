-- ============================================================
-- Migration 043 — Nehemiah OS v2: Living Agent Memories & Knowledge
-- ============================================================
-- Persistent long-term memory for the Nehemiah AI Agent per client.
-- Stores decisions, insights, preferences, financial facts, and notes
-- accumulated across chat conversations, emails, and sheet updates.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.v2_agent_memories (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID         NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  category         TEXT         NOT NULL DEFAULT 'insight'
                     CHECK (category IN (
                       'insight',        -- תובנה עסקית/פיננסית
                       'decision',       -- החלטה או סיכום פגישה
                       'preference',     -- העדפת עבודה או דרישה של הלקוח
                       'financial_fact', -- עובדה פיננסית/מספרית (שיעור מע"מ, סכום קבוע וכו')
                       'contact',        -- איש קשר או שותף חדש
                       'note'            -- הערה כללית
                     )),
  content          TEXT         NOT NULL,
  importance       TEXT         NOT NULL DEFAULT 'medium'
                     CHECK (importance IN ('low', 'medium', 'high')),
  source           TEXT         NOT NULL DEFAULT 'chat',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_v2_agent_memories_client_id
  ON public.v2_agent_memories (client_id);

CREATE INDEX IF NOT EXISTS idx_v2_agent_memories_category
  ON public.v2_agent_memories (category);

CREATE INDEX IF NOT EXISTS idx_v2_agent_memories_importance
  ON public.v2_agent_memories (importance);

-- Permissions
GRANT ALL ON public.v2_agent_memories TO postgres, service_role, authenticated;

-- RLS
ALTER TABLE public.v2_agent_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to v2_agent_memories" ON public.v2_agent_memories;
CREATE POLICY "Service role has full access to v2_agent_memories" ON public.v2_agent_memories
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage client memories" ON public.v2_agent_memories;
CREATE POLICY "Authenticated users can manage client memories" ON public.v2_agent_memories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.v2_agent_memories IS
  'Continuous living memory and knowledge accumulated by the Nehemiah AI Agent for each client.';
