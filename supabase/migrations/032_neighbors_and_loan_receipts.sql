-- ============================================================
-- Migration 032 — Neighbors and Loan Receipts
-- ============================================================

-- ============================================================
-- Neighbors (שכנים)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.moshe_neighbors (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   UUID NOT NULL REFERENCES public.moshe_projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  notes        TEXT,
  total_amount NUMERIC(15,2),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Neighbor Payments (תשלומי שכנים)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.moshe_neighbor_payments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  neighbor_id  UUID NOT NULL REFERENCES public.moshe_neighbors(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES public.moshe_projects(id) ON DELETE CASCADE,
  amount       NUMERIC(15,2) NOT NULL,
  due_date     DATE,
  is_paid      BOOLEAN NOT NULL DEFAULT false,
  paid_at      TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Loan Receipts (קבלת הלוואה בתשלומים)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.moshe_loan_receipts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id      UUID NOT NULL REFERENCES public.moshe_loans(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES public.moshe_projects(id) ON DELETE CASCADE,
  amount       NUMERIC(15,2) NOT NULL,
  due_date     DATE,
  is_received  BOOLEAN NOT NULL DEFAULT false,
  received_at  TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_moshe_neighbors_proj   ON public.moshe_neighbors(project_id);
CREATE INDEX IF NOT EXISTS idx_moshe_np_neighbor      ON public.moshe_neighbor_payments(neighbor_id);
CREATE INDEX IF NOT EXISTS idx_moshe_np_proj          ON public.moshe_neighbor_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_moshe_lr_loan          ON public.moshe_loan_receipts(loan_id);
CREATE INDEX IF NOT EXISTS idx_moshe_lr_proj          ON public.moshe_loan_receipts(project_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.moshe_neighbors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moshe_neighbor_payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moshe_loan_receipts         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read moshe_neighbors"         ON public.moshe_neighbors          FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read moshe_neighbor_payments" ON public.moshe_neighbor_payments  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read moshe_loan_receipts"     ON public.moshe_loan_receipts      FOR SELECT TO authenticated USING (true);

-- Service role full access
CREATE POLICY "service all moshe_neighbors"         ON public.moshe_neighbors          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service all moshe_neighbor_payments" ON public.moshe_neighbor_payments  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service all moshe_loan_receipts"     ON public.moshe_loan_receipts      FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- GRANTS
-- ============================================================
GRANT ALL ON TABLE public.moshe_neighbors TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.moshe_neighbor_payments TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.moshe_loan_receipts TO anon, authenticated, service_role;
