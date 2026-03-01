import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function init() {
    console.log('Inserting default SMTP settings...');
    const { data, error } = await supabase
        .from('smtp_settings')
        .upsert({
            id: 'main',
            host: 'smtp.gmail.com',
            port: 465,
            user: 'placeholder@gmail.com',
            password: 'placeholder-password',
            updated_at: new Date().toISOString()
        });

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Success:', data);
    }
}

init();
