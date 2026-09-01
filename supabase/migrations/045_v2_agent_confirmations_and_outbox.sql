CREATE TABLE IF NOT EXISTS public.v2_agent_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  payload_hash text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS v2_agent_confirmations_user_pending_idx
  ON public.v2_agent_confirmations(user_id, expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE public.v2_agent_confirmations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.v2_agent_confirmations TO service_role;

CREATE TABLE IF NOT EXISTS public.v2_job_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS v2_job_outbox_pending_idx
  ON public.v2_job_outbox(status, available_at);

ALTER TABLE public.v2_job_outbox ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.v2_job_outbox TO service_role;
