-- ============================================================
-- Migration 040 — Nehemiah OS v2: Client Onboarding Context
-- ============================================================
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_context_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_clients_client_context
  ON public.clients
  USING gin (client_context_json);

COMMENT ON COLUMN public.clients.client_context_json IS
  'Structured client onboarding context (ClientContext JSON schema). Populated by the AI agent during the discovery phase. Empty object = onboarding not yet completed.';
