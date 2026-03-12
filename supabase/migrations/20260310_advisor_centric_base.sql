-- Advisor Management Extension Schema
-- This schema adds professional advisor features like recurring tasks and internal notes.

-- 1. Extend clients table with advisor-only fields
ALTER TABLE clients ADD COLUMN IF NOT EXISTS advisor_status TEXT DEFAULT 'onboarding';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- 2. Extend reminders table with recursion and categorization
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS recurrence_rule TEXT; -- e.g., 'weekly', 'monthly', 'yearly'
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'task'; -- e.g., 'phone_call', 'meeting', 'review'
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS last_generated_date TIMESTAMPTZ;

-- 3. Create a table for meeting summaries/logs
CREATE TABLE IF NOT EXISTS meeting_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    meeting_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    meeting_type TEXT DEFAULT 'monthly_review',
    subject TEXT NOT NULL,
    summary TEXT,
    action_items TEXT, -- Stored as text or markdown
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Recurring task generation log (to prevent duplicates)
CREATE TABLE IF NOT EXISTS recurring_task_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reminder_template_id UUID NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
    generated_for_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(reminder_template_id, generated_for_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clients_advisor_status ON clients(advisor_status);
CREATE INDEX IF NOT EXISTS idx_reminders_recurring ON reminders(recurrence_rule) WHERE recurrence_rule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meeting_logs_client ON meeting_logs(client_id);
