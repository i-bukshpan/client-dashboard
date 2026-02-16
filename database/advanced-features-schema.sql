-- Additional SQL for Advanced Features
-- Run this AFTER running schema-updates.sql

-- 5. Saved Filters Table (for Advanced Filtering)
CREATE TABLE IF NOT EXISTS saved_filters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  filter_config JSONB NOT NULL,
  module_name TEXT NOT NULL,
  is_shared BOOLEAN DEFAULT FALSE,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_filters_client ON saved_filters(client_id, module_name);

-- 6. Pivot Configurations Table (for Pivot Tables)
CREATE TABLE IF NOT EXISTS pivot_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  module_name TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pivot_configs_client ON pivot_configs(client_id, module_name);

-- Enable RLS for new tables
ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE pivot_configs ENABLE ROW LEVEL SECURITY;

-- Create policies for new tables
CREATE POLICY "Allow all operations on saved_filters" ON saved_filters FOR ALL USING (true);
CREATE POLICY "Allow all operations on pivot_configs" ON pivot_configs FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON saved_filters TO anon, authenticated;
GRANT ALL ON pivot_configs TO anon, authenticated;

SELECT 'Advanced features schema created successfully!' as status;
