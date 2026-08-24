-- ============================================================
-- Migration 035 — Nehemiah OS v2: Google Workspace Integration
-- ============================================================
-- Adds Google Sheets and dynamic dashboard support to the clients table.
-- All changes are additive (IF NOT EXISTS / safe defaults).
-- ============================================================

-- ── 1. Extend the clients table ──────────────────────────────────────────────

ALTER TABLE public.clients
  -- ID of the client's primary Google Spreadsheet (the Single Source of Truth)
  ADD COLUMN IF NOT EXISTS google_sheet_id TEXT,
  -- JSON schema that drives the dynamic dashboard renderer in v2 UI.
  -- Stored as JSONB for indexing and partial querying.
  ADD COLUMN IF NOT EXISTS dashboard_config_json JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── 2. Indexes ────────────────────────────────────────────────────────────────

-- Fast lookup by sheet ID (e.g. when a webhook references a sheet)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_google_sheet_id
  ON public.clients (google_sheet_id)
  WHERE google_sheet_id IS NOT NULL;

-- GIN index on the dashboard config for future JSON path queries
CREATE INDEX IF NOT EXISTS idx_clients_dashboard_config
  ON public.clients
  USING gin (dashboard_config_json);

-- ── 3. Comments ───────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.clients.google_sheet_id IS
  'Google Sheets spreadsheet ID. Populated by the AI agent during client onboarding. NULL = sheet not yet created.';

COMMENT ON COLUMN public.clients.dashboard_config_json IS
  'Dynamic dashboard layout config (DashboardConfig JSON schema). Updated by the AI agent via update_dashboard_layout tool. Empty object = no dashboard configured yet.';
