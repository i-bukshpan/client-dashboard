-- Fix: Add missing updated_at to reminders to fix trigger error
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Fix: Add missing client_activity_logs table
CREATE TABLE IF NOT EXISTS client_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index for fast timeline queries
CREATE INDEX IF NOT EXISTS idx_client_activity_logs_client_id ON client_activity_logs(client_id);
