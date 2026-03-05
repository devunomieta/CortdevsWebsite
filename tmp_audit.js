import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aaogkoqxodxnhqhysyxn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhb2drb3F4b2R4bmhxaHlzeXhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjIyMzE0NSwiZXhwIjoyMDg3Nzk5MTQ1fQ.LLDp68-2y53gYY7LwZE9nRDHD8Mk-TCyL3MHqzHvB_U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log("--- Column Audit ---");

    // Check leads
    const { data: leads } = await supabase.from('leads').select('*').limit(1);
    console.log("Leads columns:", leads && leads[0] ? Object.keys(leads[0]) : "Empty or error");

    // Check clients
    const { data: clients } = await supabase.from('clients').select('*').limit(1);
    console.log("Clients columns:", clients && clients[0] ? Object.keys(clients[0]) : "Empty or error");

    // Try a direct select from profiles to verify it exists
    const { data: profiles } = await supabase.from('profiles').select('full_name').limit(1);
    console.log("Profiles access:", profiles ? "OK" : "Failed");

    console.log("--- End Audit ---");
}

diagnose();
