-- ============================================================
-- Migration 030 — Bot Pending Actions (Stateful API)
-- שומר את הפעולה הממתינה האחרונה עבור כל מספר טלפון
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bot_pending_actions (
  phone         TEXT        PRIMARY KEY, -- כל משתמש יכול להמתין לפעולה אחת בלבד
  action_type   TEXT        NOT NULL,
  action_params JSONB       NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS (Row Level Security)
ALTER TABLE public.bot_pending_actions ENABLE ROW LEVEL SECURITY;

-- Service role (ה-API הפנימי שלנו) רשאי לעשות הכל
CREATE POLICY "service all pending_actions"
  ON public.bot_pending_actions FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON public.bot_pending_actions TO service_role;
