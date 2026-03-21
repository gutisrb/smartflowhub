import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key. Please run: source .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchLeads() {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, company_name, website, niche, status, intake_data, email_draft')
    .eq('client_id', '69acf7e9-557e-4ca3-85bd-a785ef39e351');

  if (error) {
    console.error('Error fetching leads:', error);
  } else {
    fs.writeFileSync('leads_dump.json', JSON.stringify(data, null, 2));
    console.log(`Saved ${data.length} leads to leads_dump.json`);
  }
}

fetchLeads();
