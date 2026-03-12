-- Migration: Add extra identity fields to client_credentials
-- Identity number and additional_info for complex login scenarios

ALTER TABLE client_credentials 
ADD COLUMN IF NOT EXISTS identity_number TEXT,
ADD COLUMN IF NOT EXISTS additional_info TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update the existing records if necessary (not needed for now)
