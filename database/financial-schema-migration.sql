-- Add financial metadata to client_schemas
ALTER TABLE client_schemas ADD COLUMN IF NOT EXISTS financial_type TEXT CHECK (financial_type IN ('income', 'expense'));
ALTER TABLE client_schemas ADD COLUMN IF NOT EXISTS amount_column TEXT;
ALTER TABLE client_schemas ADD COLUMN IF NOT EXISTS date_column TEXT;
ALTER TABLE client_schemas ADD COLUMN IF NOT EXISTS description_column TEXT;
