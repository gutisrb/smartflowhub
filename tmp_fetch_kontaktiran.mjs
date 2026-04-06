import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getKontaktiranLeads() {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, company_name, website, niche, intake_data, email_draft, status, service')
    .eq('status', 'Kontaktiran')
    .eq('client_id', '69acf7e9-557e-4ca3-85bd-a785ef39e351');

  if (error) {
    console.error('Error:', error);
  } else {
    process.stdout.write(JSON.stringify(data));
  }
}

getKontaktiranLeads();
