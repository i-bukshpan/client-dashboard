const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  
  // Get user from auth
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
  if (authErr) {
    console.error('Error fetching users:', authErr);
    return;
  }
  
  const adminUser = authData.users.find(u => u.email === adminEmail);
  if (!adminUser) {
    console.error('Admin user not found in auth.users!');
    return;
  }

  // Upsert profile
  const { data, error } = await supabaseAdmin.from('profiles').upsert({
    id: adminUser.id,
    email: adminEmail,
    full_name: 'נחמיה דרוק',
    role: 'admin',
    salary_base: 0
  });

  if (error) {
    console.error('Failed to upsert admin profile:', error);
  } else {
    console.log('Successfully upserted admin profile!');
  }
}

main();
