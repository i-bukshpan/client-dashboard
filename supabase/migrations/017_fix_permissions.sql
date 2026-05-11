-- Fix permission denied errors for new tables by granting explicitly to service_role

GRANT ALL ON moshe_workers                    TO service_role;
GRANT ALL ON moshe_worker_project_permissions TO service_role;
GRANT ALL ON moshe_worker_logs                TO service_role;
GRANT ALL ON moshe_audit_log                  TO service_role;

-- Also ensure anon/authenticated have what they need
GRANT SELECT, INSERT, UPDATE, DELETE ON moshe_workers                    TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON moshe_worker_project_permissions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON moshe_worker_logs                TO anon, authenticated;
GRANT SELECT, INSERT               ON moshe_audit_log                   TO anon, authenticated;

-- Re-run portal_access column addition in case it was missed
ALTER TABLE moshe_partners
  ADD COLUMN IF NOT EXISTS portal_access BOOLEAN NOT NULL DEFAULT false;
