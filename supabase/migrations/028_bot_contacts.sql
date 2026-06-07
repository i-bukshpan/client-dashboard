-- ============================================================
-- Migration 028 — Bot Contacts
-- ממפה מספרי טלפון וואטסאפ לסוג משתמש ולUID ב-DB
-- פורמט טלפון: 972XXXXXXXXX (ללא + ללא רווחים)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bot_contacts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT        NOT NULL UNIQUE,
  -- admin = מנהל כללי של האתר
  -- moshe_admin = משה (בעל פורטל הנדל"ן)
  -- worker = עובד בשטח (moshe_workers)
  -- partner = שותף בפרויקט (moshe_partners)
  user_type   TEXT        NOT NULL CHECK (user_type IN ('admin','moshe_admin','worker','partner')),
  ref_id      UUID,       -- UUID מהטבלה המתאימה (worker_id / partner_id)
  name        TEXT,       -- שם לתצוגה בלבד
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_contacts_phone    ON public.bot_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_bot_contacts_type     ON public.bot_contacts(user_type);
CREATE INDEX IF NOT EXISTS idx_bot_contacts_ref_id   ON public.bot_contacts(ref_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.bot_contacts_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_contacts_updated_at ON public.bot_contacts;
CREATE TRIGGER bot_contacts_updated_at
  BEFORE UPDATE ON public.bot_contacts
  FOR EACH ROW EXECUTE FUNCTION public.bot_contacts_set_updated_at();

-- RLS
ALTER TABLE public.bot_contacts ENABLE ROW LEVEL SECURITY;

-- Service role (n8n + internal-agent) — full access
CREATE POLICY "service all bot_contacts"
  ON public.bot_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Admin authenticated — can read and manage
CREATE POLICY "auth all bot_contacts"
  ON public.bot_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.bot_contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_contacts TO authenticated;
