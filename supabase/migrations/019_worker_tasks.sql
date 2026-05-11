CREATE TABLE IF NOT EXISTS moshe_worker_tasks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id  UUID        NOT NULL REFERENCES moshe_workers(id) ON DELETE CASCADE,
  project_id UUID        REFERENCES moshe_projects(id) ON DELETE SET NULL,
  title      TEXT        NOT NULL,
  notes      TEXT,
  due_date   DATE,
  is_done    BOOLEAN     NOT NULL DEFAULT false,
  done_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moshe_worker_tasks_worker_id_idx ON moshe_worker_tasks(worker_id);

GRANT ALL ON moshe_worker_tasks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON moshe_worker_tasks TO anon, authenticated;
