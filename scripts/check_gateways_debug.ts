import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGateways() {
    const { data, error } = await supabase.from('payment_gateways').select('*');
    if (error) {
        console.error('Error fetching gateways:', error);
    } else {
        console.log('Gateways found:', JSON.stringify(data, null, 2));
    }
}

checkGateways();
