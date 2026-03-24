-- Saved AI Responses
-- Run in Supabase SQL Editor (safe to re-run)

CREATE TABLE IF NOT EXISTS ai_saved_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT,
  context_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_saved_responses_created
  ON ai_saved_responses(created_at DESC);

GRANT ALL ON ai_saved_responses TO anon, authenticated;

ALTER TABLE ai_saved_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on ai_saved_responses" ON ai_saved_responses;
CREATE POLICY "Allow all on ai_saved_responses"
  ON ai_saved_responses FOR ALL USING (true) WITH CHECK (true);
