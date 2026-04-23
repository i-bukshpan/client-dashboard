const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debug() {
  console.log('--- Supabase Debug Start ---');
  console.log('URL:', supabaseUrl);
  console.log('Service Key Start:', supabaseServiceKey.substring(0, 10) + '...');

  // 1. Test Auth Connection
  console.log('\n1. Testing Auth Connection...');
  const { data: users, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1 });
  if (authError) {
    console.error('Auth Error:', authError.message);
  } else {
    console.log('Auth Success! Found', users.users.length, 'users.');
  }

  // 2. Test Table Selection
  console.log('\n2. Testing SELECT from profiles...');
  const { data: profiles, error: selectError } = await supabase.from('profiles').select('*').limit(1);
  if (selectError) {
    console.error('Select Error:', selectError.code, selectError.message);
  } else {
    console.log('Select Success! Found', profiles.length, 'profiles.');
  }

  // 3. Test Table Insertion (Dry run/Rollback)
  console.log('\n3. Testing INSERT into profiles (dry run)...');
  const dummyId = '00000000-0000-0000-0000-000000000000';
  const { error: insertError } = await supabase.from('profiles').insert({
    id: dummyId,
    full_name: 'Debug User',
    role: 'employee'
  });
  
  if (insertError) {
    console.error('Insert Error:', insertError.code, insertError.message);
    if (insertError.code === '42501') {
      console.log('ROOT CAUSE CONFIRMED: RLS or GRANTs are blocking the service role key.');
    }
  } else {
    console.log('Insert Success! (Note: You might want to delete this dummy user manually if it stayed)');
    // Cleanup
    await supabase.from('profiles').delete().eq('id', dummyId);
  }

  console.log('\n--- Debug Complete ---');
}

debug();
