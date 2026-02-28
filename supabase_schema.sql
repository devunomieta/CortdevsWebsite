-- 0. Dependencies
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Leads Table
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    service TEXT,
    budget TEXT,
    status TEXT DEFAULT 'New',
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Clients Table
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    company TEXT,
    project_name TEXT,
    total_value TEXT,
    paid_amount TEXT,
    status TEXT DEFAULT 'In Progress',
    review JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Site Config Table
CREATE TABLE IF NOT EXISTS site_config (
    id TEXT PRIMARY KEY DEFAULT 'main',
    header_logo TEXT,
    footer_logo TEXT,
    favicon TEXT,
    site_title TEXT,
    meta_description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default config
INSERT INTO site_config (id, header_logo, footer_logo, favicon, site_title, meta_description)
VALUES ('main', '/logo-dark.svg', '/logo-light.svg', '/favicon.ico', 'CortDevs | Premium Web Solutions', 'Crafting digital excellence through innovative web solutions.')
ON CONFLICT (id) DO NOTHING;

-- 4. Newsletter Subscribers Table
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'Subscribed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Email Templates Table
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT,
    subject TEXT,
    content TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. SMTP Settings Table
CREATE TABLE IF NOT EXISTS smtp_settings (
    id TEXT PRIMARY KEY DEFAULT 'main',
    host TEXT,
    port INTEGER,
    "user" TEXT,
    password TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    type TEXT CHECK (type IN ('Income', 'Expense')),
    amount DECIMAL(12,2),
    description TEXT,
    category TEXT,
    status TEXT DEFAULT 'Completed', -- 'Pending', 'Completed', 'Failed'
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Profiles Table (RBAC)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    role TEXT DEFAULT 'Editor', -- 'Super Admin', 'Project Manager', 'Editor'
    permissions TEXT[], -- ['Leads', 'Clients', 'Comms', 'Settings', 'Templates']
    status TEXT DEFAULT 'Active',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE smtp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policies for Leads
DROP POLICY IF EXISTS admin_all_access ON leads;
CREATE POLICY admin_all_access ON leads FOR ALL USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS public_insert_leads ON leads;
CREATE POLICY public_insert_leads ON leads FOR INSERT WITH CHECK (true);

-- Policies for Clients
DROP POLICY IF EXISTS admin_all_access ON clients;
CREATE POLICY admin_all_access ON clients FOR ALL USING (auth.role() = 'authenticated');

-- Policies for Site Config
DROP POLICY IF EXISTS admin_all_access ON site_config;
CREATE POLICY admin_all_access ON site_config FOR ALL USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS public_read_config ON site_config;
CREATE POLICY public_read_config ON site_config FOR SELECT USING (true);

-- Policies for Newsletter Subscribers
DROP POLICY IF EXISTS admin_all_access ON newsletter_subscribers;
CREATE POLICY admin_all_access ON newsletter_subscribers FOR ALL USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS public_insert_newsletter ON newsletter_subscribers;
CREATE POLICY public_insert_newsletter ON newsletter_subscribers FOR INSERT WITH CHECK (true);

-- Policies for Email Templates
DROP POLICY IF EXISTS admin_all_access ON email_templates;
CREATE POLICY admin_all_access ON email_templates FOR ALL USING (auth.role() = 'authenticated');

-- Policies for SMTP Settings
DROP POLICY IF EXISTS admin_all_access ON smtp_settings;
CREATE POLICY admin_all_access ON smtp_settings FOR ALL USING (auth.role() = 'authenticated');

-- Policies for Profiles
DROP POLICY IF EXISTS admin_read_profiles ON profiles;
CREATE POLICY admin_read_profiles ON profiles FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS super_admin_all_profiles ON profiles;
CREATE POLICY super_admin_all_profiles ON profiles FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Super Admin'
    )
);

-- Policies for Transactions
DROP POLICY IF EXISTS admin_all_access ON transactions;
CREATE POLICY admin_all_access ON transactions FOR ALL USING (auth.role() = 'authenticated');

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role, permissions)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email, 'Editor', ARRAY['Settings']);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Storage Instructions
-- NOTE: Supabase Storage buckets cannot be fully managed via SQL in all environments.
-- 1. Go to "Storage" in the sidebar.
-- 2. Create a new bucket named "assets".
-- 3. Set the bucket to "Public" (or define specific RLS policies).

-- SQL to create bucket and policies
INSERT INTO storage.buckets (id, name, public) 
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for storage
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'assets');

DROP POLICY IF EXISTS "Admin Upload" ON storage.objects;
CREATE POLICY "Admin Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'assets' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin Delete" ON storage.objects;
CREATE POLICY "Admin Delete" ON storage.objects FOR DELETE USING (bucket_id = 'assets' AND auth.role() = 'authenticated');

-- 9. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT CHECK (type IN ('Lead', 'Transaction', 'System', 'Review')),
    message TEXT NOT NULL,
    link TEXT,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_all_access ON notifications;
CREATE POLICY admin_all_access ON notifications FOR ALL USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS public_insert_notifications ON notifications;
CREATE POLICY public_insert_notifications ON notifications FOR INSERT WITH CHECK (true);

-- 10. Communications/Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES auth.users(id),
    receiver_email TEXT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    type TEXT CHECK (type IN ('Lead', 'Client', 'Newsletter', 'Direct')),
    is_sent BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_all_messages ON messages;
CREATE POLICY admin_all_messages ON messages FOR ALL USING (auth.role() = 'authenticated');
