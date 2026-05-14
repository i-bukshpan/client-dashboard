-- Fix FK constraints that prevent profile/user deletion
-- conversations → profiles: add ON DELETE CASCADE
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_employee_id_fkey,
  ADD CONSTRAINT conversations_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_admin_id_fkey,
  ADD CONSTRAINT conversations_admin_id_fkey
    FOREIGN KEY (admin_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- expenses.created_by → profiles: set null instead of restrict
ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_created_by_fkey,
  ADD CONSTRAINT expenses_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- chat_messages.sender_id → profiles: make nullable + set null
ALTER TABLE public.chat_messages
  ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_sender_id_fkey,
  ADD CONSTRAINT chat_messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
