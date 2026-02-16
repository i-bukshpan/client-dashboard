-- Version History & Validation System Tables
-- Run this in your Supabase SQL Editor

-- 1. Record History Table
CREATE TABLE IF NOT EXISTS record_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT DEFAULT 'system',
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  change_type TEXT DEFAULT 'update' CHECK (change_type IN ('create', 'update', 'delete'))
);

-- Indexes for record_history
CREATE INDEX IF NOT EXISTS idx_history_record ON record_history(record_id);
CREATE INDEX IF NOT EXISTS idx_history_table ON record_history(table_name, client_id);
CREATE INDEX IF NOT EXISTS idx_history_time ON record_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_client ON record_history(client_id);

-- 2. Validation Rules Table  
CREATE TABLE IF NOT EXISTS validation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  field_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('required', 'min', 'max', 'pattern', 'custom', 'email', 'phone', 'url')),
  rule_value TEXT,
  error_message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for validation_rules
CREATE INDEX IF NOT EXISTS idx_validation_module ON validation_rules(client_id, module_name) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_validation_field ON validation_rules(client_id, module_name, field_name);

-- 3. Table Relationships (for future use)
CREATE TABLE IF NOT EXISTS table_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  source_module TEXT NOT NULL,
  target_module TEXT NOT NULL,
  source_key TEXT NOT NULL,
  target_key TEXT NOT NULL,
  relationship_type TEXT DEFAULT '1:N' CHECK (relationship_type IN ('1:1', '1:N', 'N:M')),
  cascade_delete BOOLEAN DEFAULT FALSE,
  display_in_source BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for table_relationships
CREATE INDEX IF NOT EXISTS idx_relationships_source ON table_relationships(client_id, source_module);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON table_relationships(client_id, target_module);

-- 4. Add columns to existing clients table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='clients' AND column_name='is_favorite') THEN
    ALTER TABLE clients ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE;
    CREATE INDEX idx_clients_favorite ON clients(is_favorite) WHERE is_favorite = TRUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='clients' AND column_name='last_data_update') THEN
    ALTER TABLE clients ADD COLUMN last_data_update TIMESTAMPTZ;
  END IF;
END $$;

-- Enable RLS (Row Level Security) - Optional but recommended
ALTER TABLE record_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_relationships ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your authentication setup)
-- For now, allow all operations (you should restrict this later)
CREATE POLICY "Allow all operations on record_history" ON record_history FOR ALL USING (true);
CREATE POLICY "Allow all operations on validation_rules" ON validation_rules FOR ALL USING (true);
CREATE POLICY "Allow all operations on table_relationships" ON table_relationships FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON record_history TO anon, authenticated;
GRANT ALL ON validation_rules TO anon, authenticated;
GRANT ALL ON table_relationships TO anon, authenticated;

-- Success message
SELECT 'Database schema created successfully!' as status;
