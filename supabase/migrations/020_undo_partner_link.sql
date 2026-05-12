-- ============================================================
-- Migration 020 — Undo snapshots + partner transaction link
-- ============================================================

-- Add undo support to audit log
ALTER TABLE public.moshe_audit_log
  ADD COLUMN IF NOT EXISTS undo_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS is_undone      BOOLEAN NOT NULL DEFAULT false;

-- Allow service_role to update audit entries (for marking as undone)
GRANT UPDATE ON public.moshe_audit_log TO service_role;

-- Link partner transactions to their source regular transaction (optional)
ALTER TABLE public.moshe_partner_transactions
  ADD COLUMN IF NOT EXISTS source_transaction_id UUID REFERENCES public.moshe_transactions(id) ON DELETE SET NULL;
