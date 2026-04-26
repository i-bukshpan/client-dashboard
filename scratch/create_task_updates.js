const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://yqygvotrcbfndaijjxhq.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxeWd2b3RyY2JmbmRhaWpqeGhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQyMzYzOSwiZXhwIjoyMDgxOTk5NjM5fQ.jCN756gAzj7J-jcIsAVql73IyGcMnmj6novQVvJOxCM');

async function run() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.task_updates (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES public.profiles(id),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE public.task_updates ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Update Select" ON public.task_updates;
    CREATE POLICY "Update Select" ON public.task_updates FOR SELECT USING (
      public.is_admin() OR 
      EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_updates.task_id AND tasks.assigned_to = auth.uid())
    );
    
    DROP POLICY IF EXISTS "Update Insert" ON public.task_updates;
    CREATE POLICY "Update Insert" ON public.task_updates FOR INSERT WITH CHECK (
      user_id = auth.uid() AND (
        public.is_admin() OR 
        EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_updates.task_id AND tasks.assigned_to = auth.uid())
      )
    );
  `;
  
  const { error } = await s.rpc('exec_sql', { sql });
  if (error) console.error(error);
  else console.log('Table and policies created successfully');
}

run();
