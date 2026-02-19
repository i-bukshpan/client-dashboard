-- Add parent_id to clients table for parent-child hierarchy
-- A client with parent_id = NULL is a root client (or standalone)
-- A client with parent_id set is a sub-client of that parent

ALTER TABLE clients ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES clients(id) ON DELETE CASCADE;

-- Index for efficient child lookups
CREATE INDEX IF NOT EXISTS idx_clients_parent_id ON clients(parent_id);
