-- ============================================================
-- Migration 013 — Fix RLS & Grants for Partners + Loans tables
-- Same pattern as migrations 007 & 008
-- ============================================================

-- ── moshe_partners ────────────────────────────────────────────
DROP POLICY IF EXISTS "auth read moshe_partners"              ON public.moshe_partners;
DROP POLICY IF EXISTS "service all moshe_partners"            ON public.moshe_partners;

CREATE POLICY "auth all moshe_partners" ON public.moshe_partners
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── moshe_partner_transactions ────────────────────────────────
DROP POLICY IF EXISTS "auth read moshe_partner_transactions"  ON public.moshe_partner_transactions;
DROP POLICY IF EXISTS "service all moshe_partner_transactions" ON public.moshe_partner_transactions;

CREATE POLICY "auth all moshe_partner_transactions" ON public.moshe_partner_transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── moshe_loans ───────────────────────────────────────────────
DROP POLICY IF EXISTS "auth read moshe_loans"                 ON public.moshe_loans;
DROP POLICY IF EXISTS "service all moshe_loans"               ON public.moshe_loans;

CREATE POLICY "auth all moshe_loans" ON public.moshe_loans
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── moshe_loan_payments ───────────────────────────────────────
DROP POLICY IF EXISTS "auth read moshe_loan_payments"         ON public.moshe_loan_payments;
DROP POLICY IF EXISTS "service all moshe_loan_payments"       ON public.moshe_loan_payments;

CREATE POLICY "auth all moshe_loan_payments" ON public.moshe_loan_payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── GRANT permissions (same as migration 008 pattern) ─────────
GRANT ALL ON public.moshe_partners              TO anon, authenticated, service_role;
GRANT ALL ON public.moshe_partner_transactions  TO anon, authenticated, service_role;
GRANT ALL ON public.moshe_loans                 TO anon, authenticated, service_role;
GRANT ALL ON public.moshe_loan_payments         TO anon, authenticated, service_role;
