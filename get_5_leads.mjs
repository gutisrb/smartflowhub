import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SMARTFLOW_CLIENT_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data: leads, error } = await supabase
    .from('contacts')
    .select('id, company_name, website, niche, intake_data, email_draft')
    .eq('client_id', SMARTFLOW_CLIENT_ID)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(JSON.stringify(leads, null, 2));
}

main();
