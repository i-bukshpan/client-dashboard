-- migration 029: extra admin phone number for bot
-- Run in Supabase SQL editor

INSERT INTO bot_contacts (phone, user_type, name, notes)
VALUES (
  '972504283555',
  'admin',
  'מנהל נוסף',
  'גישת admin נוספת - מוגדרת ידנית'
)
ON CONFLICT (phone) DO UPDATE SET
  user_type = 'admin',
  notes = 'גישת admin נוספת - מוגדרת ידנית';
