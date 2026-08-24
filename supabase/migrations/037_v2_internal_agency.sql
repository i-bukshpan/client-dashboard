-- Nehemiah OS v2 internal agency workspace.
-- Financial records never live here: they remain exclusively in Google Sheets.

CREATE TABLE IF NOT EXISTS public.v2_agency_workspace (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton_key),
  workbook_id TEXT NOT NULL,
  drive_folder_id TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.v2_agency_workspace ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_agency_workspace_admin_all"
  ON public.v2_agency_workspace FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT ALL ON public.v2_agency_workspace TO service_role;

COMMENT ON TABLE public.v2_agency_workspace IS
  'Nehemiah OS v2 pointer to the Internal Agency Google Drive folder and workbook. Contains no financial records.';
