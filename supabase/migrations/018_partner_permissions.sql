-- Add per-section view permissions to partner portal

ALTER TABLE moshe_partners
  ADD COLUMN IF NOT EXISTS can_view_payments     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_buyers       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_transactions BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_loans        BOOLEAN NOT NULL DEFAULT false;
