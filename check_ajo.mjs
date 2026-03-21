import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ndazbdkytcksmhoabtgs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYXpiZGt5dGNrc21ob2FidGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTc0ODEsImV4cCI6MjA4NjA3MzQ4MX0.ZvJKvdaVIGPJMVxmVCALJzWuHsOfkQzNpWpC8W8tiR8';
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
