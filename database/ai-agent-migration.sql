-- AI Agent & Google Drive Integration Migration
-- 1. Enable Vector Extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create Document Embeddings Table (for Google Drive Sync)
CREATE TABLE IF NOT EXISTS document_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  drive_item_id TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768), -- Gemini Text Embedding dimension
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for vector search (Cosine Similarity)
CREATE INDEX ON document_embeddings USING ivfflat (embedding vector_cosine_ops);

-- 3. Add Google Drive references to clients
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT,
ADD COLUMN IF NOT EXISTS last_ai_sync TIMESTAMPTZ;

-- 4. Agent Chat Session Management
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
