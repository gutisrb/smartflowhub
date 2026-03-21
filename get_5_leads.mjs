import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ndazbdkytcksmhoabtgs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYXpiZGt5dGNrc21ob2FidGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTc0ODEsImV4cCI6MjA4NjA3MzQ4MX0.ZvJKvdaVIGPJMVxmVCALJzWuHsOfkQzNpWpC8W8tiR8';
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
