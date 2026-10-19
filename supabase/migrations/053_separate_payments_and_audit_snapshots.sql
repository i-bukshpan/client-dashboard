-- Migration 053 — Separate payments and movements & add audit snapshots
-- 1. moshe_audit_log
ALTER TABLE public.moshe_audit_log
  ADD COLUMN IF NOT EXISTS previous_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS new_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS undo_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS is_undone BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS undone_at TIMESTAMPTZ;

-- 2. moshe_project_payments
ALTER TABLE public.moshe_project_payments
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'schedule'
  CHECK (payment_type IN ('schedule', 'movement'));

-- 3. moshe_buyer_payments
ALTER TABLE public.moshe_buyer_payments
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'schedule'
  CHECK (payment_type IN ('schedule', 'movement'));
