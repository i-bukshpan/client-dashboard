-- Add payment-to-table linking fields
ALTER TABLE payments ADD COLUMN IF NOT EXISTS linked_module TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS linked_record_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS linked_record_label TEXT;
