-- Add custom date field to project logs
ALTER TABLE moshe_project_logs
  ADD COLUMN IF NOT EXISTS log_date DATE;

-- ─── Audit / Activity Journal ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS moshe_audit_log (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID        REFERENCES moshe_projects(id) ON DELETE SET NULL,
  user_email  TEXT,
  user_name   TEXT,
  action_type TEXT        NOT NULL,  -- 'create' | 'update' | 'delete'
  entity_type TEXT        NOT NULL,  -- 'buyer' | 'payment' | 'loan' | 'partner' | 'transaction' | 'document' | 'log'
  entity_id   TEXT,
  description TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE moshe_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_read"  ON moshe_audit_log FOR SELECT USING (true);
CREATE POLICY "audit_write" ON moshe_audit_log FOR INSERT WITH CHECK (true);
GRANT SELECT, INSERT ON moshe_audit_log TO anon, authenticated;

-- ─── Workers ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS moshe_workers (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT        NOT NULL,
  phone      TEXT,
  email      TEXT        UNIQUE,
  role       TEXT        DEFAULT 'worker',  -- 'worker' | 'foreman'
  notes      TEXT,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moshe_worker_project_permissions (
  id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id  UUID    NOT NULL REFERENCES moshe_workers(id) ON DELETE CASCADE,
  project_id UUID    NOT NULL REFERENCES moshe_projects(id) ON DELETE CASCADE,
  can_view   BOOLEAN NOT NULL DEFAULT true,
  can_log    BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(worker_id, project_id)
);

CREATE TABLE IF NOT EXISTS moshe_worker_logs (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id  UUID        NOT NULL REFERENCES moshe_workers(id) ON DELETE CASCADE,
  project_id UUID        REFERENCES moshe_projects(id) ON DELETE SET NULL,
  log_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
  note       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE moshe_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE moshe_worker_project_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE moshe_worker_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workers_read"  ON moshe_workers FOR SELECT USING (true);
CREATE POLICY "workers_write" ON moshe_workers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "wpp_read"      ON moshe_worker_project_permissions FOR SELECT USING (true);
CREATE POLICY "wpp_write"     ON moshe_worker_project_permissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "wlog_read"     ON moshe_worker_logs FOR SELECT USING (true);
CREATE POLICY "wlog_write"    ON moshe_worker_logs FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON moshe_workers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON moshe_worker_project_permissions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON moshe_worker_logs TO anon, authenticated;

-- ─── Partners portal email ─────────────────────────────────────────────────────
-- Partners already have email field; we add a flag for portal access
ALTER TABLE moshe_partners
  ADD COLUMN IF NOT EXISTS portal_access BOOLEAN NOT NULL DEFAULT false;
