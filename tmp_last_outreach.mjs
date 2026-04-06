import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getLastOutreach() {
  console.log('Fetching last sent outreach...');
  const { data: log, error: logError } = await supabase
    .from('smartflow_outreach_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (logError) {
    console.error('Error fetching log:', logError);
  } else {
    console.log('Last Log:', JSON.stringify(log, null, 2));
    
    if (log && log.length > 0) {
      const { data: lead, error: leadError } = await supabase
        .from('smartflow_leads')
        .select('*')
        .eq('id', log[0].lead_id)
        .single();
        
      if (leadError) {
        console.error('Error fetching lead:', leadError);
      } else {
        console.log('Associated Lead:', JSON.stringify(lead, null, 2));
      }
    }
  }
}

getLastOutreach();
