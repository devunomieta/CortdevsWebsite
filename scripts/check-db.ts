import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('--- SMTP Settings ---');
    const { data: smtp, error: e1 } = await supabase.from('smtp_settings').select('*');
    console.log(smtp || e1);

    console.log('--- Last 5 Messages ---');
    const { data: msgs, error: e2 } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(5);
    console.log(msgs || e2);
}

check();
