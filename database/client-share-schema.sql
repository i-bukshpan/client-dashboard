-- Add share_token and share_permissions to clients table

-- 1. Add share_token column (unique token for public access)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- 2. Add share_permissions column (JSONB to store access rules)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS share_permissions JSONB DEFAULT '{
  "allow_edit": false,
  "show_overview": true,
  "show_billing": true,
  "show_credentials": false,
  "show_notes": false,
  "allowed_modules": []
}'::jsonb;

-- 3. Create index for faster lookup by token
CREATE INDEX IF NOT EXISTS idx_clients_share_token ON clients(share_token);

-- 4. Update existing clients with default permissions if null
UPDATE clients 
SET share_permissions = '{
  "allow_edit": false,
  "show_overview": true,
  "show_billing": true,
  "show_credentials": false,
  "show_notes": false,
  "allowed_modules": []
}'::jsonb
WHERE share_permissions IS NULL;

-- 5. Notify
SELECT 'Client share schema updated successfully' as status;
