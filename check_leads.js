
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLeads() {
    console.log('Searching kontakti_legacy for MJOB or Kristina...');
    const { data: leads, error: leadsError } = await supabase
        .from('kontakti_legacy')
        .select('*')
        .or('kompanija.ilike.%MJOB%,ime.ilike.%Kristina%');

    if (leadsError) {
        console.error('Error fetching kontakti_legacy:', leadsError);
    } else {
        console.log('Search Results:', JSON.stringify(leads, null, 2));
    }
}

checkLeads();
