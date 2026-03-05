import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aaogkoqxodxnhqhysyxn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhb2drb3F4b2R4bmhxaHlzeXhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjIyMzE0NSwiZXhwIjoyMDg3Nzk5MTQ1fQ.LLDp68-2y53gYY7LwZE9nRDHD8Mk-TCyL3MHqzHvB_U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDatabase() {
    console.log("--- Starting Database Fix ---");

    // Using rpc or direct sql via migrations is preferred, but here I'll try to use a function or check if I can add columns.
    // Since Supabase JS doesn't have a direct 'ALTER TABLE', and I don't see an 'exec_sql' RPC,
    // I will check if I can use a migrations file approach or if I can just notify the user if I can't do it programmatically.
    // WAIT, I can use the 'REST' API to some extent but not for DDL.

    // However, I can try to run the SQL via a migration script if there's an endpoint, 
    // but usually, it's done via Supabase CLI or Dashboard.

    // I'll check if there's a 'query' RPC by chance.
    const { data: rpcData, error: rpcError } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });

    if (rpcError) {
        console.log("No 'exec_sql' RPC found. I will have to advise the user to run the SQL or try to find another way.");
        console.log("Error details:", rpcError);
    } else {
        console.log("RPC 'exec_sql' found! Applying fixes...");

        const sql = `
            ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS onboarded_by UUID REFERENCES public.profiles(id);
            ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS onboarded_by UUID REFERENCES public.profiles(id);
        `;

        const { error: applyError } = await supabase.rpc('exec_sql', { sql });
        if (applyError) {
            console.error("Failed to apply SQL:", applyError.message);
        } else {
            console.log("Database columns added successfully.");
        }
    }

    console.log("--- Database Fix Finished ---");
}

fixDatabase();
