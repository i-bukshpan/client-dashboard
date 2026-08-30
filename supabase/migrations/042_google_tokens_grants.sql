-- ============================================================
-- Migration 042: Grants and RLS Fix for google_tokens
-- ============================================================

GRANT ALL ON public.google_tokens TO postgres, service_role, authenticated;

ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to google_tokens" ON public.google_tokens;
CREATE POLICY "Service role has full access to google_tokens" ON public.google_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can only see their own tokens" ON public.google_tokens;
CREATE POLICY "Users can only see their own tokens" ON public.google_tokens 
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own tokens" ON public.google_tokens;
CREATE POLICY "Users can manage their own tokens" ON public.google_tokens 
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
