import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkErrors() {
  console.log("Fetching recent anomalies from server_errors...");
  const { data, error } = await supabase
    .from('server_errors')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching logs:", error);
    return;
  }

  if (!data || data.length === 0) {
    console.log("No error logs found.");
    return;
  }

  data.forEach((log, i) => {
    console.log(`\n--- Error ${i + 1} ---`);
    console.log(`Time: ${log.created_at}`);
    console.log(`Location: ${log.location}`);
    console.log(`Message: ${log.message}`);
    console.log(`Details: ${JSON.stringify(log.details, null, 2)}`);
  });
}

checkErrors();
