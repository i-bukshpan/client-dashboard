-- ============================================================
-- Migration 022 — Worker Bot Messages & Replies
-- ============================================================

-- הודעות שהמנהל שולח לעובד (משימות / שליחויות / אירועים / הודעות)
CREATE TABLE IF NOT EXISTS public.worker_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id   UUID        NOT NULL REFERENCES public.moshe_workers(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL DEFAULT 'message'
                CHECK (type IN ('task','delivery','event','message')),
  title       TEXT        NOT NULL,
  body        TEXT,
  due_date    TIMESTAMPTZ,
  location    TEXT,
  priority    TEXT        NOT NULL DEFAULT 'normal'
                CHECK (priority IN ('low','normal','high','urgent')),
  status      TEXT        NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','in_progress','done','cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- תגובות לכל הודעה (שיחת עובד ↔ מנהל)
CREATE TABLE IF NOT EXISTS public.worker_message_replies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID        NOT NULL REFERENCES public.worker_messages(id) ON DELETE CASCADE,
  sender      TEXT        NOT NULL CHECK (sender IN ('worker','admin')),
  body        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wm_worker  ON public.worker_messages(worker_id);
CREATE INDEX IF NOT EXISTS idx_wm_status  ON public.worker_messages(status);
CREATE INDEX IF NOT EXISTS idx_wmr_msg    ON public.worker_message_replies(message_id);

-- RLS
ALTER TABLE public.worker_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_message_replies  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read worker_messages"        ON public.worker_messages        FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read worker_message_replies" ON public.worker_message_replies FOR SELECT TO authenticated USING (true);

-- Grants (service role manages everything, auth can insert replies)
GRANT ALL ON public.worker_messages        TO service_role;
GRANT ALL ON public.worker_message_replies TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.worker_messages        TO authenticated;
GRANT SELECT, INSERT         ON public.worker_message_replies TO authenticated;
