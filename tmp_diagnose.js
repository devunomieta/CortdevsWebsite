import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aaogkoqxodxnhqhysyxn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhb2drb3F4b2R4bmhxaHlzeXhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjIyMzE0NSwiZXhwIjoyMDg3Nzk5MTQ1fQ.LLDp68-2y53gYY7LwZE9nRDHD8Mk-TCyL3MHqzHvB_U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log("--- Starting Diagnosis (ESM) ---");

    try {
        const tables = ['leads', 'clients', 'documentation'];

        for (const table of tables) {
            console.log(`\nChecking table: ${table}`);
            const { data, error } = await supabase.from(table).select('*').limit(1);

            if (error) {
                console.error(`  Error:`, error.message);
            } else {
                console.log(`  Sample:`, data);
                if (data && data.length > 0) {
                    console.log(`  Columns:`, Object.keys(data[0]).join(', '));
                } else {
                    console.log(`  Table is empty.`);
                }
            }
        }

        console.log("\nTesting Join: leads -> profiles (onboarded_by)");
        const { error: joinLeadsError } = await supabase
            .from('leads')
            .select('*, onboarder:onboarded_by(full_name)')
            .limit(1);

        if (joinLeadsError) {
            console.error(`  Join Leads Error:`, joinLeadsError.message);
        } else {
            console.log(`  Join Leads Success!`);
        }

        console.log("Testing Join: clients -> profiles (onboarded_by)");
        const { error: joinClientsError } = await supabase
            .from('clients')
            .select('*, onboarder:onboarded_by(full_name)')
            .limit(1);

        if (joinClientsError) {
            console.error(`  Join Clients Error:`, joinClientsError.message);
        } else {
            console.log(`  Join Clients Success!`);
        }

    } catch (e) {
        console.error("Fatal Error:", e);
    }

    console.log("\n--- Diagnosis Finished ---");
}

diagnose();
