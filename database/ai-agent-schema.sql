-- AI Agent Chat History Tables
-- Run this in Supabase SQL Editor
-- Safe to run multiple times (idempotent)

-- Session: represents one conversation
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  title TEXT,
  page_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages: every user/assistant message in a session
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session
  ON ai_chat_messages(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_updated
  ON ai_chat_sessions(updated_at DESC);

-- Grant access (required for Supabase anon/authenticated client)
GRANT ALL ON ai_chat_sessions TO anon, authenticated;
GRANT ALL ON ai_chat_messages TO anon, authenticated;

-- RLS: enable and allow all (tighten per-user later if needed)
ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop old policies first to avoid conflicts on re-run
DROP POLICY IF EXISTS "Allow all on ai_chat_sessions" ON ai_chat_sessions;
DROP POLICY IF EXISTS "Allow all on ai_chat_messages" ON ai_chat_messages;

-- Policies: WITH CHECK (true) covers INSERT, USING (true) covers SELECT/UPDATE/DELETE
CREATE POLICY "Allow all on ai_chat_sessions"
  ON ai_chat_sessions FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on ai_chat_messages"
  ON ai_chat_messages FOR ALL USING (true) WITH CHECK (true);
