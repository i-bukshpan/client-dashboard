-- ============================================================
-- Migration 014 — Add partner_id to transactions, create
--                 categories table, trigger for default partner
-- ============================================================

-- ── Add partner_id to moshe_transactions ──────────────────────
ALTER TABLE public.moshe_transactions
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.moshe_partners(id) ON DELETE SET NULL;

-- ── Create moshe_transaction_categories ───────────────────────
CREATE TABLE IF NOT EXISTS public.moshe_transaction_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  color       text DEFAULT '#6366f1',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.moshe_transaction_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth all moshe_transaction_categories" ON public.moshe_transaction_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.moshe_transaction_categories TO anon, authenticated, service_role;

-- ── Seed some default categories ──────────────────────────────
INSERT INTO public.moshe_transaction_categories (name, color) VALUES
  ('שכ"ט עורך דין', '#8b5cf6'),
  ('שכ"ט יועץ', '#6366f1'),
  ('עבודות בנייה', '#f59e0b'),
  ('חומרי בנייה', '#ef4444'),
  ('שיווק ומכירות', '#10b981'),
  ('אגרות ומיסים', '#64748b'),
  ('מימון', '#3b82f6'),
  ('הכנסה ממכירה', '#22c55e'),
  ('דמי שכירות', '#14b8a6'),
  ('הכנסה אחרת', '#84cc16')
ON CONFLICT (name) DO NOTHING;

-- ── Function to ensure default "משה פרוש" partner per project ─
CREATE OR REPLACE FUNCTION public.ensure_default_moshe_partner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- When a new project is created, automatically add משה פרוש as a partner
  INSERT INTO public.moshe_partners (project_id, name, notes)
  VALUES (NEW.id, 'משה פרוש', 'בעל האתר - שותף ברירת מחדל')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger (drop first to be idempotent)
DROP TRIGGER IF EXISTS trigger_default_partner ON public.moshe_projects;
CREATE TRIGGER trigger_default_partner
  AFTER INSERT ON public.moshe_projects
  FOR EACH ROW EXECUTE FUNCTION public.ensure_default_moshe_partner();

-- Backfill existing projects that don't have משה פרוש yet
INSERT INTO public.moshe_partners (project_id, name, notes)
SELECT p.id, 'משה פרוש', 'בעל האתר - שותף ברירת מחדל'
FROM public.moshe_projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.moshe_partners pt
  WHERE pt.project_id = p.id AND pt.name = 'משה פרוש'
);
