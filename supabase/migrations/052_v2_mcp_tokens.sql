-- Migration: 052_v2_mcp_tokens.sql
-- Table for managing Model Context Protocol (MCP) access tokens for external WhatsApp bots & agents

CREATE TABLE IF NOT EXISTS public.v2_mcp_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_preview TEXT NOT NULL,
  encrypted_token TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  permissions TEXT[] NOT NULL DEFAULT ARRAY['read_drive', 'read_clients', 'read_sheets', 'read_tasks', 'read_calendar'],
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_v2_mcp_tokens_hash ON public.v2_mcp_access_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_v2_mcp_tokens_active ON public.v2_mcp_access_tokens (is_active);

ALTER TABLE public.v2_mcp_access_tokens ENABLE ROW LEVEL SECURITY;

-- Only service_role can directly manage tokens; authenticated users query via server actions
CREATE POLICY "service_role_all_mcp_tokens"
  ON public.v2_mcp_access_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.v2_mcp_access_tokens TO service_role;
