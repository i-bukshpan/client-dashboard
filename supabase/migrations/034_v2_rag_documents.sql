-- ============================================================
-- Migration 034 — V2 RAG: Document Intelligence
-- ============================================================
-- דרישת קדם: הפעל pgvector ב-Supabase Dashboard לפני הרצת המיגרציה הזו:
--   Dashboard → Database → Extensions → חפש "vector" → Enable
-- ⚠️  ממשק V2 בלבד. אין שום שינוי בטבלאות קיימות.
-- ============================================================

-- וידוא שה-extension מותקן
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- טבלה 1: v2_client_documents — מטא-דאטה של מסמכים
-- ============================================================
CREATE TABLE IF NOT EXISTS public.v2_client_documents (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID         NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_name        TEXT         NOT NULL,
  file_type        TEXT         NOT NULL DEFAULT 'other'
                     CHECK (file_type IN (
                       'receipt',    -- קבלה
                       'invoice',    -- חשבונית
                       'contract',   -- חוזה
                       'report',     -- דוח
                       'other'       -- אחר
                     )),
  -- שדות Google Drive
  drive_file_id    TEXT         UNIQUE,  -- מזהה קובץ ב-Drive
  drive_url        TEXT,                 -- קישור לצפייה
  drive_folder_id  TEXT,                 -- תיקיית הלקוח ב-Drive
  -- שדות OCR (Gemini Multimodal)
  ocr_status       TEXT         NOT NULL DEFAULT 'pending'
                     CHECK (ocr_status IN ('pending', 'processing', 'done', 'failed')),
  ocr_text         TEXT,                 -- הטקסט שחולץ
  ocr_error        TEXT,                 -- שגיאה אם כשלה
  ocr_model        TEXT,                 -- המודל שחולץ (gemini-2.0-flash וכו')
  -- מטא-דאטה נוסף
  file_size_bytes  BIGINT,
  mime_type        TEXT,
  file_date        DATE,                 -- תאריך המסמך (מתוך OCR)
  amount           NUMERIC(12, 2),       -- סכום שחולץ אוטומטית
  currency         TEXT         DEFAULT 'ILS',
  tags             TEXT[]       DEFAULT '{}',
  -- audit
  uploaded_by      UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- trigger לעדכון updated_at אוטומטי
CREATE OR REPLACE FUNCTION public.v2_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER v2_client_documents_updated_at
  BEFORE UPDATE ON public.v2_client_documents
  FOR EACH ROW EXECUTE FUNCTION public.v2_set_updated_at();

-- אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_v2_docs_client_id   ON public.v2_client_documents (client_id);
CREATE INDEX IF NOT EXISTS idx_v2_docs_ocr_status  ON public.v2_client_documents (ocr_status) WHERE ocr_status != 'done';
CREATE INDEX IF NOT EXISTS idx_v2_docs_file_type   ON public.v2_client_documents (file_type);
CREATE INDEX IF NOT EXISTS idx_v2_docs_file_date   ON public.v2_client_documents (file_date DESC NULLS LAST);

-- ============================================================
-- טבלה 2: v2_document_chunks — chunks עם embeddings
-- ============================================================
-- ⚠️ Gemini text-embedding-004 מייצר 768 ממדים (לא 1536!)
CREATE TABLE IF NOT EXISTS public.v2_document_chunks (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID         NOT NULL
                  REFERENCES public.v2_client_documents(id) ON DELETE CASCADE,
  chunk_index   INTEGER      NOT NULL,          -- סדר ה-chunk במסמך
  content       TEXT         NOT NULL,          -- תוכן הטקסט של ה-chunk
  embedding     vector(768),                    -- Gemini text-embedding-004 = 768 dims
  token_count   INTEGER,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  UNIQUE (document_id, chunk_index)
);

-- אינדקס IVFFlat לחיפוש קוסינוס מהיר
-- ⚠️ נוצר כשיש לפחות 100 שורות נתונים (אחרת ה-Planner מתעלם ממנו)
CREATE INDEX IF NOT EXISTS idx_v2_chunks_embedding
  ON public.v2_document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

CREATE INDEX IF NOT EXISTS idx_v2_chunks_document_id
  ON public.v2_document_chunks (document_id);

-- ============================================================
-- פונקציה: search_v2_documents — חיפוש סמנטי
-- ============================================================
-- שימוש ב-RPC: supabase.rpc('search_v2_documents', { query_embedding: [...768], p_client_id: '...' })
CREATE OR REPLACE FUNCTION public.search_v2_documents(
  query_embedding  vector(768),
  p_client_id      UUID    DEFAULT NULL,
  p_file_type      TEXT    DEFAULT NULL,
  match_threshold  FLOAT   DEFAULT 0.65,
  match_count      INTEGER DEFAULT 10
)
RETURNS TABLE (
  chunk_id       UUID,
  document_id    UUID,
  file_name      TEXT,
  content        TEXT,
  similarity     FLOAT,
  client_id      UUID,
  file_type      TEXT,
  file_date      DATE,
  amount         NUMERIC,
  drive_url      TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    dc.id                                          AS chunk_id,
    dc.document_id,
    cd.file_name,
    dc.content,
    1 - (dc.embedding <=> query_embedding)         AS similarity,
    cd.client_id,
    cd.file_type,
    cd.file_date,
    cd.amount,
    cd.drive_url
  FROM public.v2_document_chunks dc
  JOIN public.v2_client_documents cd ON dc.document_id = cd.id
  WHERE
    cd.ocr_status = 'done'
    AND dc.embedding IS NOT NULL
    AND (p_client_id IS NULL OR cd.client_id = p_client_id)
    AND (p_file_type IS NULL OR cd.file_type = p_file_type)
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- טבלה 3: v2_ocr_queue — תור OCR לעיבוד רקע ע"י n8n
-- ============================================================
CREATE TABLE IF NOT EXISTS public.v2_ocr_queue (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID        NOT NULL
                 REFERENCES public.v2_client_documents(id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'queued'
                 CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  attempts     INTEGER     NOT NULL DEFAULT 0,
  last_error   TEXT,
  queued_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_v2_ocr_queue_pending
  ON public.v2_ocr_queue (queued_at ASC)
  WHERE status = 'queued';

-- ============================================================
-- RLS — Row Level Security
-- ============================================================
ALTER TABLE public.v2_client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_document_chunks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_ocr_queue        ENABLE ROW LEVEL SECURITY;

-- מנהל: גישה מלאה (משתמש בפונקציה is_admin() הקיימת ממיגרציה 001)
CREATE POLICY "v2_docs_admin_all"
  ON public.v2_client_documents FOR ALL
  USING (public.is_admin());

CREATE POLICY "v2_chunks_admin_all"
  ON public.v2_document_chunks FOR ALL
  USING (public.is_admin());

CREATE POLICY "v2_ocr_queue_admin_all"
  ON public.v2_ocr_queue FOR ALL
  USING (public.is_admin());

-- service_role (n8n, API Routes פנימיות): גישה מלאה ללא RLS
GRANT ALL ON public.v2_client_documents TO service_role;
GRANT ALL ON public.v2_document_chunks  TO service_role;
GRANT ALL ON public.v2_ocr_queue        TO service_role;
GRANT EXECUTE ON FUNCTION public.search_v2_documents TO service_role;
GRANT EXECUTE ON FUNCTION public.search_v2_documents TO authenticated;

-- Realtime לטבלת התור (n8n מאזין לאירועים INSERT)
ALTER PUBLICATION supabase_realtime ADD TABLE public.v2_ocr_queue;
