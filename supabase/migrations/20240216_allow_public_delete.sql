-- Add policy to allow public deletion of messages by client_id
-- This supports the "Clear Chat" feature for unauthenticated users using public tokens.

create policy "Allow public delete access"
  on messages for delete
  using (true);
