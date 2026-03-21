-- Add details column to meeting_logs table
ALTER TABLE meeting_logs ADD COLUMN IF NOT EXISTS details TEXT;
