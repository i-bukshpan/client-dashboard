-- Ensure google_tokens RLS policies exist (idempotent)
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only see their own tokens" ON public.google_tokens;
CREATE POLICY "Users can only see their own tokens" ON public.google_tokens
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own tokens" ON public.google_tokens;
CREATE POLICY "Users can manage their own tokens" ON public.google_tokens
  FOR ALL USING (user_id = auth.uid());
