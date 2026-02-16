-- Set REPLICA IDENTITY to FULL for the messages table.
-- This allows realtime delete events to include the full row data,
-- enabling row-level filtering (e.g., by client_id) for DELETE events.
alter table messages replica identity full;
