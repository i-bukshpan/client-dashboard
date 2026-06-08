-- ============================================================
-- Migration 031 — Bot Reminders
-- תזכורות ל-WhatsApp (ידניות + אוטומטיות)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bot_reminders (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         TEXT        NOT NULL,
  user_name     TEXT,
  message       TEXT        NOT NULL,
  reminder_type TEXT        NOT NULL DEFAULT 'custom'
                  CHECK (reminder_type IN (
                    'custom',         -- תזכורת ידנית שהמשתמש יצר
                    'payment_due',    -- תשלום שמועדו היום/מחר
                    'meeting_today',  -- פגישה היום
                    'daily_tasks',    -- סיכום משימות יומי לעובד
                    'overdue'         -- דוח איחורי תשלומים שבועי
                  )),
  scheduled_at  TIMESTAMPTZ NOT NULL,
  sent_at       TIMESTAMPTZ,
  is_sent       BOOLEAN     NOT NULL DEFAULT false,
  is_recurring  BOOLEAN     NOT NULL DEFAULT false,
  recur_cron    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_reminders_pending ON public.bot_reminders (is_sent, scheduled_at)
  WHERE is_sent = false;
CREATE INDEX IF NOT EXISTS idx_bot_reminders_phone ON public.bot_reminders (phone);

-- RLS
ALTER TABLE public.bot_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service all bot_reminders"
  ON public.bot_reminders FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON public.bot_reminders TO service_role;

-- ── שדרוג bot_pending_actions: הוספת expires_at (TTL 15 דקות) ──────────────
ALTER TABLE public.bot_pending_actions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT now() + interval '15 minutes';
