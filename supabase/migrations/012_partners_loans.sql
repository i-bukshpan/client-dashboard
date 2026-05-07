-- ============================================================
-- Migration 012 — Partners (שותפים) + Loans (הלוואות)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- שותפים בפרויקט
-- ============================================================
CREATE TABLE IF NOT EXISTS public.moshe_partners (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   UUID NOT NULL REFERENCES public.moshe_projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- תנועות כספיות של שותפים
-- ============================================================
CREATE TABLE IF NOT EXISTS public.moshe_partner_transactions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id   UUID NOT NULL REFERENCES public.moshe_partners(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES public.moshe_projects(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('investment','withdrawal')),
  amount       NUMERIC(15,2) NOT NULL,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- הלוואות בפרויקט
-- ============================================================
CREATE TABLE IF NOT EXISTS public.moshe_loans (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id     UUID NOT NULL REFERENCES public.moshe_projects(id) ON DELETE CASCADE,
  lender         TEXT NOT NULL,                     -- מי נתן את ההלוואה
  arranged_by    UUID REFERENCES public.moshe_partners(id) ON DELETE SET NULL,  -- איזה שותף דאג
  total_amount   NUMERIC(15,2) NOT NULL,
  interest_rate  NUMERIC(5,2),                      -- ריבית באחוזים
  num_payments   INTEGER NOT NULL DEFAULT 1,        -- כמות תשלומים
  start_date     DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- תשלומי הלוואה
-- ============================================================
CREATE TABLE IF NOT EXISTS public.moshe_loan_payments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id      UUID NOT NULL REFERENCES public.moshe_loans(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES public.moshe_projects(id) ON DELETE CASCADE,
  amount       NUMERIC(15,2) NOT NULL,
  due_date     DATE,
  is_paid      BOOLEAN NOT NULL DEFAULT false,
  paid_at      TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_moshe_partners_proj   ON public.moshe_partners(project_id);
CREATE INDEX IF NOT EXISTS idx_moshe_ptx_partner     ON public.moshe_partner_transactions(partner_id);
CREATE INDEX IF NOT EXISTS idx_moshe_ptx_proj        ON public.moshe_partner_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_moshe_loans_proj      ON public.moshe_loans(project_id);
CREATE INDEX IF NOT EXISTS idx_moshe_lp_loan         ON public.moshe_loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_moshe_lp_proj         ON public.moshe_loan_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_moshe_lp_due          ON public.moshe_loan_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_moshe_lp_paid         ON public.moshe_loan_payments(is_paid);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.moshe_partners              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moshe_partner_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moshe_loans                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moshe_loan_payments         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read moshe_partners"              ON public.moshe_partners              FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read moshe_partner_transactions"  ON public.moshe_partner_transactions  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read moshe_loans"                 ON public.moshe_loans                 FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read moshe_loan_payments"         ON public.moshe_loan_payments         FOR SELECT TO authenticated USING (true);

-- Service role full access
CREATE POLICY "service all moshe_partners"              ON public.moshe_partners              FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service all moshe_partner_transactions"  ON public.moshe_partner_transactions  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service all moshe_loans"                 ON public.moshe_loans                 FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service all moshe_loan_payments"         ON public.moshe_loan_payments         FOR ALL TO service_role USING (true) WITH CHECK (true);
