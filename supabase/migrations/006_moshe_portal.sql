-- ============================================================
-- Migration 006 — Moshe Portal (פרויקטי טאבו משותף)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- פרויקטים
-- ============================================================
CREATE TABLE IF NOT EXISTS public.moshe_projects (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  address      TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  total_project_cost NUMERIC(15,2),
  notes        TEXT,
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','pending','closed')),
  start_date   DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- לוח תשלומים — הוצאות הפרויקט
-- ============================================================
CREATE TABLE IF NOT EXISTS public.moshe_project_payments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES public.moshe_projects(id) ON DELETE CASCADE,
  amount      NUMERIC(15,2) NOT NULL,
  due_date    DATE,           -- null = תאריך לא נקבע עדיין
  notes       TEXT,
  is_paid     BOOLEAN NOT NULL DEFAULT false,
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- קונים בפרויקט
-- ============================================================
CREATE TABLE IF NOT EXISTS public.moshe_buyers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       UUID NOT NULL REFERENCES public.moshe_projects(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  phone            TEXT,
  email            TEXT,
  id_number        TEXT,
  unit_description TEXT,   -- דירה X, קומה Y
  contract_date    DATE,
  total_amount     NUMERIC(15,2),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- לוח תשלומים — קונה (הכנסות)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.moshe_buyer_payments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id    UUID NOT NULL REFERENCES public.moshe_buyers(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES public.moshe_projects(id) ON DELETE CASCADE,
  amount      NUMERIC(15,2) NOT NULL,
  due_date    DATE,           -- null = תאריך לא נקבע עדיין
  notes       TEXT,
  is_received BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- עסקאות כלליות לפרויקט (הוצאות/הכנסות חופשיות)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.moshe_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES public.moshe_projects(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount      NUMERIC(15,2) NOT NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  category    TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- אירועי יומן ידניים
-- ============================================================
CREATE TABLE IF NOT EXISTS public.moshe_calendar_events (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time   TIMESTAMPTZ,
  notes      TEXT,
  type       TEXT NOT NULL DEFAULT 'meeting'
               CHECK (type IN ('meeting','reminder','other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_moshe_pp_project  ON public.moshe_project_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_moshe_pp_due      ON public.moshe_project_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_moshe_pp_paid     ON public.moshe_project_payments(is_paid);
CREATE INDEX IF NOT EXISTS idx_moshe_buyers_proj ON public.moshe_buyers(project_id);
CREATE INDEX IF NOT EXISTS idx_moshe_bp_buyer    ON public.moshe_buyer_payments(buyer_id);
CREATE INDEX IF NOT EXISTS idx_moshe_bp_proj     ON public.moshe_buyer_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_moshe_bp_due      ON public.moshe_buyer_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_moshe_bp_recv     ON public.moshe_buyer_payments(is_received);
CREATE INDEX IF NOT EXISTS idx_moshe_tx_proj     ON public.moshe_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_moshe_tx_date     ON public.moshe_transactions(date);
CREATE INDEX IF NOT EXISTS idx_moshe_ev_start    ON public.moshe_calendar_events(start_time);

-- ============================================================
-- RLS — only service role writes; reads open for now
-- (הגנה אמיתית דרך middleware ו-server actions)
-- ============================================================
ALTER TABLE public.moshe_projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moshe_project_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moshe_buyers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moshe_buyer_payments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moshe_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moshe_calendar_events  ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read (server-side auth handles who can access)
CREATE POLICY "auth read moshe_projects"         ON public.moshe_projects         FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read moshe_project_payments" ON public.moshe_project_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read moshe_buyers"           ON public.moshe_buyers           FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read moshe_buyer_payments"   ON public.moshe_buyer_payments   FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read moshe_transactions"     ON public.moshe_transactions     FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read moshe_calendar_events"  ON public.moshe_calendar_events  FOR SELECT TO authenticated USING (true);
