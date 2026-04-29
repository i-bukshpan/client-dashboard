-- ============================================================
-- Migration 008 — Grant table permissions for Moshe portal
-- Tables created via raw SQL don't auto-grant to Supabase roles
-- ============================================================

GRANT ALL ON public.moshe_projects         TO anon, authenticated, service_role;
GRANT ALL ON public.moshe_project_payments TO anon, authenticated, service_role;
GRANT ALL ON public.moshe_buyers           TO anon, authenticated, service_role;
GRANT ALL ON public.moshe_buyer_payments   TO anon, authenticated, service_role;
GRANT ALL ON public.moshe_transactions     TO anon, authenticated, service_role;
GRANT ALL ON public.moshe_calendar_events  TO anon, authenticated, service_role;
