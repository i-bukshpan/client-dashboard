-- ============================================================
-- Migration 021 — Worker per-project data visibility
-- ============================================================

ALTER TABLE public.moshe_worker_project_permissions
  ADD COLUMN IF NOT EXISTS can_view_payments BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_buyers   BOOLEAN NOT NULL DEFAULT false;
