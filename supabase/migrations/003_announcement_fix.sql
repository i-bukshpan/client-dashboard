-- Add target_employee_id to announcements
ALTER TABLE public.employee_announcements 
ADD COLUMN IF NOT EXISTS target_employee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
