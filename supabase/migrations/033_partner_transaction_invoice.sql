-- ============================================================
-- Migration 033 — Partner Transaction Invoice & VAT
-- מוסיף תמיכה במשיכה מול חשבונית עבור שותפים
-- ============================================================

ALTER TABLE public.moshe_partner_transactions
ADD COLUMN IF NOT EXISTS has_invoice BOOLEAN NOT NULL DEFAULT false;
