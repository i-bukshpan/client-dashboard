-- Enable Realtime for messages table
begin;
  -- Check if publication exists, if not create it (standard in Supabase but good to be safe)
  -- Actually, supabase_realtime is default. We just need to add the table.
  -- use do block to avoid error if already added? simpler to just run the alter command, 
  -- standard supabase setup includes the publication.

  alter publication supabase_realtime add table messages;
commit;
