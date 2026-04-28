-- 002_new_features.sql

-- Goals Table
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  target_amount DECIMAL,
  current_amount DECIMAL DEFAULT 0,
  target_date DATE,
  assigned_employee UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_client UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Recurring Finances
CREATE TABLE IF NOT EXISTS public.recurring_finances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount DECIMAL NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Employee Announcements
CREATE TABLE IF NOT EXISTS public.employee_announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Chat Read Receipts
CREATE TABLE IF NOT EXISTS public.chat_read_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Row Level Security
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_read_receipts ENABLE ROW LEVEL SECURITY;

-- Goals Policies
CREATE POLICY "Enable read access for all authenticated users" ON public.goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable all access for admins" ON public.goals FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Recurring Finances Policies
CREATE POLICY "Enable read access for all authenticated users" ON public.recurring_finances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable all access for admins" ON public.recurring_finances FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Announcements Policies
CREATE POLICY "Enable read access for all authenticated users" ON public.employee_announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable all access for admins" ON public.employee_announcements FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Chat Read Receipts Policies
CREATE POLICY "Enable read access for all authenticated users" ON public.chat_read_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.chat_read_receipts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
