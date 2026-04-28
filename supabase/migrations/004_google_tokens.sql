-- Create google_tokens table
CREATE TABLE IF NOT EXISTS public.google_tokens (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can only see their own tokens" ON public.google_tokens;
CREATE POLICY "Users can only see their own tokens" ON public.google_tokens 
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own tokens" ON public.google_tokens;
CREATE POLICY "Users can manage their own tokens" ON public.google_tokens 
  FOR ALL USING (user_id = auth.uid());

-- Add google_event_id to appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS google_event_id TEXT UNIQUE;
