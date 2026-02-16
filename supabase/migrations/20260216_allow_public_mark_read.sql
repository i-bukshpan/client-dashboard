-- Allow anyone to mark messages as read
-- This is necessary if the dashboard is used without full Supabase Auth
create policy "Allow anyone to mark as read"
  on messages for update
  using (true)
  with check (is_read = true);

-- Also ensure REPLICA IDENTITY is set to FULL for accurate realtime updates
alter table messages replica identity full;
