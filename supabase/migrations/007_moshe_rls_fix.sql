-- ============================================================
-- Migration 007 — Fix RLS for Moshe portal tables
-- Access is controlled at middleware level (admin + Moshe only)
-- so we allow full CRUD for authenticated users on all moshe_ tables
-- ============================================================

-- ── moshe_projects ──────────────────────────────────────────
DROP POLICY IF EXISTS "auth read moshe_projects" ON public.moshe_projects;

CREATE POLICY "auth all moshe_projects" ON public.moshe_projects
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── moshe_project_payments ──────────────────────────────────
DROP POLICY IF EXISTS "auth read moshe_project_payments" ON public.moshe_project_payments;

CREATE POLICY "auth all moshe_project_payments" ON public.moshe_project_payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── moshe_buyers ────────────────────────────────────────────
DROP POLICY IF EXISTS "auth read moshe_buyers" ON public.moshe_buyers;

CREATE POLICY "auth all moshe_buyers" ON public.moshe_buyers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── moshe_buyer_payments ────────────────────────────────────
DROP POLICY IF EXISTS "auth read moshe_buyer_payments" ON public.moshe_buyer_payments;

CREATE POLICY "auth all moshe_buyer_payments" ON public.moshe_buyer_payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── moshe_transactions ──────────────────────────────────────
DROP POLICY IF EXISTS "auth read moshe_transactions" ON public.moshe_transactions;

CREATE POLICY "auth all moshe_transactions" ON public.moshe_transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── moshe_calendar_events ───────────────────────────────────
DROP POLICY IF EXISTS "auth read moshe_calendar_events" ON public.moshe_calendar_events;

CREATE POLICY "auth all moshe_calendar_events" ON public.moshe_calendar_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
