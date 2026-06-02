-- ============================================================
-- Migration 027 — Partner Transactions: Add 'expense' type
-- ============================================================

-- Drop the old constraint
ALTER TABLE public.moshe_partner_transactions DROP CONSTRAINT IF EXISTS moshe_partner_transactions_type_check;

-- Add the new constraint with 'expense'
ALTER TABLE public.moshe_partner_transactions ADD CONSTRAINT moshe_partner_transactions_type_check CHECK (type IN ('investment', 'withdrawal', 'expense'));
