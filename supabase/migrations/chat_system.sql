-- Create messages table
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references clients(id) on delete cascade not null,
  sender_role text check (sender_role in ('admin', 'client')) not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  is_read boolean default false,
  context_type text check (context_type in ('general', 'module', 'payment', 'credential', 'note')),
  context_id text,
  context_name text,
  context_data jsonb
);

-- Enable RLS
alter table messages enable row level security;

-- Policies

-- 1. Allow public read access (simplified for MVP - security relies on random UUIDs and app logic)
create policy "Allow public read access"
  on messages for select
  using (true);

-- 2. Allow public insert access (for clients to send messages)
create policy "Allow public insert access"
  on messages for insert
  with check (true);

-- 3. Allow update/delete only for authenticated users (Admins)
create policy "Allow admin update/delete"
  on messages for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Indexes
create index if not exists idx_messages_client_id on messages(client_id);
create index if not exists idx_messages_not_read on messages(client_id) where is_read = false;
