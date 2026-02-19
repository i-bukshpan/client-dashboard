-- Client Links Table
-- Store external links (Google Sheets, Drive, websites, etc.) per client
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS client_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  link_type TEXT DEFAULT 'other' CHECK (link_type IN ('google_sheets', 'google_drive', 'google_docs', 'dropbox', 'onedrive', 'website', 'other')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_links_client ON client_links(client_id);

-- Enable RLS
ALTER TABLE client_links ENABLE ROW LEVEL SECURITY;

-- RLS Policy (allow all - adjust for your auth setup)
CREATE POLICY "Allow all operations on client_links" ON client_links FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON client_links TO anon, authenticated;

SELECT 'Client links schema created successfully!' as status;
