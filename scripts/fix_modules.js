const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixModules() {
    console.log("Checking clients...");
    const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name');

    if (clientsError) {
        console.error("Error fetching clients:", clientsError);
        return;
    }

    for (const client of clients) {
        console.log(`Processing client: ${client.name} (${client.id})`);

        // Check if growth-engine exists
        const { data: existing, error: checkError } = await supabase
            .from('client_modules')
            .select('id')
            .eq('client_id', client.id)
            .eq('module_key', 'growth-engine')
            .single();

        if (!existing) {
            console.log(`  Adding growth-engine module...`);
            const { error: insertError } = await supabase
                .from('client_modules')
                .insert({
                    client_id: client.id,
                    module_key: 'growth-engine',
                    is_enabled: true,
                    display_name: 'Growth Engine',
                    sort_order: 1,
                    settings: {
                        statuses: ['Novi Lead', 'Kontaktiran', 'Meeting Booked', 'Closed', 'Lost']
                    }
                });

            if (insertError) {
                console.error(`  Error adding module:`, insertError);
            } else {
                console.log(`  Success!`);
            }
        } else {
            console.log(`  Module already exists.`);
        }

        // Also ensure Agent Context is updated if needed
        // (Existing agent-database module will be reused)
    }
}

fixModules();
