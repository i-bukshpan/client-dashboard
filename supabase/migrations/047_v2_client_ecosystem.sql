-- ============================================================
-- Migration 047 — Nehemiah OS v2: Client Ecosystem Upgrade
-- ============================================================
-- Supports:
-- 1. Multi-asset links (multiple Google Sheets & Drive folders per client)
-- 2. Client Vault (encrypted bank logins, CPA & tax credentials)
-- 3. Client Routines (monthly operational cadence: 1st, 5th, quarterly)
-- 4. Client Goals & Growth (business growth targets & milestones)
-- ============================================================

-- 1. Client Assets (Multiple Sheets and Drive Folders)
CREATE TABLE IF NOT EXISTS public.v2_client_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('sheet', 'drive_folder', 'link')),
  asset_id text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'invoices', 'cash_flow', 'project_taboo', 'tama38', 'tax_cpa', 'contracts')),
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS v2_client_assets_client_idx ON public.v2_client_assets(client_id, asset_type);
ALTER TABLE public.v2_client_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_client_assets_service_role" ON public.v2_client_assets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "v2_client_assets_admin_all" ON public.v2_client_assets
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT ALL ON public.v2_client_assets TO service_role;

-- 2. Client Vault (Secure Credentials for Banks, Tax, CPAs)
CREATE TABLE IF NOT EXISTS public.v2_client_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  institution_name text NOT NULL,
  account_identifier text,
  username_encrypted text NOT NULL,
  secret_encrypted text NOT NULL,
  portal_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS v2_client_vault_client_idx ON public.v2_client_vault(client_id);
ALTER TABLE public.v2_client_vault ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_client_vault_service_role" ON public.v2_client_vault
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "v2_client_vault_admin_all" ON public.v2_client_vault
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT ALL ON public.v2_client_vault TO service_role;

-- 3. Client Routines (Monthly Cadence & Regular Tasks)
CREATE TABLE IF NOT EXISTS public.v2_client_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  day_of_month integer NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 31),
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly')),
  assigned_role text NOT NULL DEFAULT 'nehemiah' CHECK (assigned_role IN ('nehemiah', 'secretary', 'cpa', 'client')),
  is_active boolean NOT NULL DEFAULT true,
  last_executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS v2_client_routines_cadence_idx ON public.v2_client_routines(day_of_month, is_active);
CREATE INDEX IF NOT EXISTS v2_client_routines_client_idx ON public.v2_client_routines(client_id);
ALTER TABLE public.v2_client_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_client_routines_service_role" ON public.v2_client_routines
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "v2_client_routines_admin_all" ON public.v2_client_routines
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT ALL ON public.v2_client_routines TO service_role;

-- 4. Client Goals & Growth (Business Objectives & Milestones)
CREATE TABLE IF NOT EXISTS public.v2_client_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  target_value numeric,
  current_value numeric,
  unit text DEFAULT '₪',
  target_date date,
  status text NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track', 'behind', 'achieved', 'paused')),
  milestones_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS v2_client_goals_client_idx ON public.v2_client_goals(client_id, status);
ALTER TABLE public.v2_client_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_client_goals_service_role" ON public.v2_client_goals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "v2_client_goals_admin_all" ON public.v2_client_goals
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT ALL ON public.v2_client_goals TO service_role;
