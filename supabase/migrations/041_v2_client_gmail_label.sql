-- ============================================================
-- Migration 041 — Nehemiah OS v2: Client Gmail Label & Filters
-- ============================================================
-- Adds gmail_label support to the clients table for per-client
-- email tracking and management in Nehemiah OS Workspace v2.
-- ============================================================

ALTER TABLE public.clients
  -- Gmail Label assigned to this client (e.g., "לקוחות/ישראל ישראלי" or "פרויקט אלפא")
  ADD COLUMN IF NOT EXISTS gmail_label TEXT;

-- Index for searching clients by Gmail label
CREATE INDEX IF NOT EXISTS idx_clients_gmail_label
  ON public.clients (gmail_label)
  WHERE gmail_label IS NOT NULL;

COMMENT ON COLUMN public.clients.gmail_label IS
  'Gmail Label assigned to this client for email filtering and correspondence tracking in Nehemiah Workspace v2.';
