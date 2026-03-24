-- Internal messaging between advisor and clients
-- Safe to run multiple times (idempotent)

CREATE TABLE IF NOT EXISTS internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('advisor', 'client')),
  sender_id TEXT NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('advisor', 'client')),
  recipient_id TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS internal_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  other_type TEXT NOT NULL CHECK (other_type IN ('advisor', 'client')),
  other_id TEXT NOT NULL,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, other_type, other_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_internal_messages_conversation ON internal_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_internal_conversations_client ON internal_conversations(client_id);

-- Grant access
GRANT ALL ON internal_messages TO anon, authenticated;
GRANT ALL ON internal_conversations TO anon, authenticated;

-- RLS
ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on internal_messages" ON internal_messages;
DROP POLICY IF EXISTS "Allow all on internal_conversations" ON internal_conversations;

CREATE POLICY "Allow all on internal_messages"
  ON internal_messages FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on internal_conversations"
  ON internal_conversations FOR ALL USING (true) WITH CHECK (true);
