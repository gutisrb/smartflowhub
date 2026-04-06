import { createClient } from '@supabase/supabase-js';
import pkg from 'dotenv';
const { config } = pkg;
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const CLIENT_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';

async function main() {
  const { data, error } = await supabase
    .from('kontakti')
    .select('status')
    .eq('client_id', CLIENT_ID);

  if (error) console.error('Error:', error);
  else {
    const counts = data.reduce((acc, lead) => {
      acc[lead.status || 'null'] = (acc[lead.status || 'null'] || 0) + 1;
      return acc;
    }, {});
    console.log('Status counts:', counts);
  }
}
main();
