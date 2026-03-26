import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDraft() {
  const { data, error } = await supabase
    .from('kontakti')
    .select('company_name, email_draft')
    .eq('company_name', 'Ajo Leather')
    .limit(1);

  if (error) {
    console.error(error);
    return;
  }
  console.log(JSON.stringify(data[0], null, 2));
}

checkDraft();
