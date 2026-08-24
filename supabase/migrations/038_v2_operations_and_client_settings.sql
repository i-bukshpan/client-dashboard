-- Nehemiah OS v2 operations pointers and per-client automation preferences.
-- Task rows remain exclusively in the Nehemiah Operations Google workbook.

CREATE TABLE IF NOT EXISTS public.v2_operations_workspace (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton_key),
  workbook_id TEXT NOT NULL,
  drive_folder_id TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.v2_client_settings (
  client_id UUID PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  reminder_default_minutes INTEGER NOT NULL DEFAULT 30 CHECK (reminder_default_minutes BETWEEN 0 AND 40320),
  monthly_brief_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  monthly_brief_day INTEGER NOT NULL DEFAULT 1 CHECK (monthly_brief_day BETWEEN 1 AND 28),
  monthly_brief_include_tasks BOOLEAN NOT NULL DEFAULT TRUE,
  monthly_brief_include_calendar BOOLEAN NOT NULL DEFAULT TRUE,
  alerts JSONB NOT NULL DEFAULT '{"overdue_tasks":true,"upcoming_tasks":true,"missing_documents":false,"cash_flow":false}'::jsonb,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.v2_operations_workspace ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_client_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_operations_workspace_admin_all" ON public.v2_operations_workspace
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "v2_client_settings_admin_all" ON public.v2_client_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT ALL ON public.v2_operations_workspace TO service_role;
GRANT ALL ON public.v2_client_settings TO service_role;

COMMENT ON TABLE public.v2_operations_workspace IS 'Pointer only to the canonical Nehemiah Operations Google workbook and Drive folder.';
COMMENT ON TABLE public.v2_client_settings IS 'CRM metadata and automation preferences only; contains no client financial records.';
