-- ============================================================
-- Migration 023 — Enable Realtime for worker bot tables
-- ============================================================

-- Replica identity full is needed for realtime column-level filters
ALTER TABLE public.worker_messages        REPLICA IDENTITY FULL;
ALTER TABLE public.worker_message_replies REPLICA IDENTITY FULL;

-- Add both tables to the supabase_realtime publication
DO $$
BEGIN
  -- worker_messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'worker_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.worker_messages;
  END IF;

  -- worker_message_replies
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'worker_message_replies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.worker_message_replies;
  END IF;
END $$;
