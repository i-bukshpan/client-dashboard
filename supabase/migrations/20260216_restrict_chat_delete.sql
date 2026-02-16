-- 1. Drop the public delete access policy
drop policy if exists "Allow public delete access" on messages;

-- 2. Ensure REPLICA IDENTITY is set to FULL for realtime sync
alter table messages replica identity full;

-- Note: The existsing "Allow admin update/delete" policy in chat_system.sql 
-- handles the restricted access for authenticated users.
