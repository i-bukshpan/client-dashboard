-- Create client_activity_logs table
CREATE TABLE IF NOT EXISTS public.client_activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- e.g., 'NOTE_ADDED', 'PAYMENT_RECEIVED', 'RECORD_CREATED', 'STATUS_CHANGED', 'INVOICE_SCANNED'
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- Store additional context (e.g., payment amount, record ID, old status vs new status)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL -- Optional, if you want to track which user did it
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_client_activity_logs_client_id ON public.client_activity_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_client_activity_logs_created_at ON public.client_activity_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.client_activity_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON public.client_activity_logs FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.client_activity_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.client_activity_logs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable deletion for all users" ON public.client_activity_logs FOR DELETE USING (true);
