import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function check() {
    console.log('Fetching latest server errors...');
    const { data, error } = await supabase
        .from('server_errors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

    if (error) {
        console.error('Failed to fetch errors:', error);
        return;
    }

    console.log(JSON.stringify(data, null, 2));
}

check();
