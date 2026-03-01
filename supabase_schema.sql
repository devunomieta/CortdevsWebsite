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
    nda_url TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
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
    maintenance_mode BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default config
INSERT INTO site_config (id, header_logo, footer_logo, favicon, site_title, meta_description, maintenance_mode)
VALUES ('main', '/logo-dark.svg', '/logo-light.svg', '/favicon.ico', 'CortDevs | Premium Web Solutions', 'Crafting digital excellence through innovative web solutions.', FALSE)
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

-- 9. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action TEXT NOT NULL,
    target_type TEXT,
    details JSONB,
    performed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Invitations Table
CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_all_audit ON audit_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY admin_all_invites ON invitations FOR ALL USING (auth.role() = 'authenticated');

-- 16. Server Errors Table
CREATE TABLE IF NOT EXISTS server_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location TEXT NOT NULL,
    message TEXT NOT NULL,
    stack TEXT,
    details JSONB,
    fix_suggestion TEXT,
    status TEXT DEFAULT 'Unresolved', -- 'Unresolved', 'Investigating', 'Resolved'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE server_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read_errors ON server_errors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY system_insert_errors ON server_errors FOR INSERT WITH CHECK (true);

-- 17. Rate Limiting Table
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier TEXT NOT NULL, -- email or IP
    action TEXT NOT NULL, -- 'password_reset', 'login_attempt'
    count INTEGER DEFAULT 1,
    last_attempt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(identifier, action)
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_all_rate_limits ON rate_limits FOR ALL USING (auth.role() = 'authenticated');

-- 18. Rate Limiting Function
CREATE OR REPLACE FUNCTION check_rate_limit(p_identifier TEXT, p_action TEXT, p_max_attempts INTEGER, p_window_interval INTERVAL)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
    v_last_attempt TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT count, last_attempt INTO v_count, v_last_attempt
    FROM rate_limits
    WHERE identifier = p_identifier AND action = p_action;

    IF NOT FOUND THEN
        INSERT INTO rate_limits (identifier, action, count, last_attempt)
        VALUES (p_identifier, p_action, 1, NOW());
        RETURN TRUE;
    END IF;

    IF v_last_attempt < (NOW() - p_window_interval) THEN
        UPDATE rate_limits
        SET count = 1, last_attempt = NOW()
        WHERE identifier = p_identifier AND action = p_action;
        RETURN TRUE;
    END IF;

    IF v_count >= p_max_attempts THEN
        RETURN FALSE;
    END IF;

    UPDATE rate_limits
    SET count = v_count + 1, last_attempt = NOW()
    WHERE identifier = p_identifier AND action = p_action;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 19. Hardened RLS Policies (RBAC)
-- Function to check if user has role
CREATE OR REPLACE FUNCTION has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = required_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Redefine Policies with Granularity

-- Leads: Super Admin/PM (All), Editor (Read/Update)
DROP POLICY IF EXISTS admin_all_access ON leads;
CREATE POLICY super_admin_pm_leads ON leads FOR ALL USING (has_role('Super Admin') OR has_role('Project Manager'));
CREATE POLICY editor_read_leads ON leads FOR SELECT USING (has_role('Editor'));
CREATE POLICY editor_update_leads ON leads FOR UPDATE USING (has_role('Editor'));

-- Clients: Super Admin/PM (All), Editor (Read)
DROP POLICY IF EXISTS admin_all_access ON clients;
CREATE POLICY super_admin_pm_clients ON clients FOR ALL USING (has_role('Super Admin') OR has_role('Project Manager'));
CREATE POLICY editor_read_clients ON clients FOR SELECT USING (has_role('Editor'));

-- Transactions: Super Admin (All), PM (Read)
DROP POLICY IF EXISTS admin_all_access ON transactions;
CREATE POLICY super_admin_transactions ON transactions FOR ALL USING (has_role('Super Admin'));
CREATE POLICY pm_read_transactions ON transactions FOR SELECT USING (has_role('Project Manager'));

-- Storage Policies: Assets (Admin All, Public Read)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access Assets" ON storage.objects FOR SELECT USING (bucket_id = 'assets');

DROP POLICY IF EXISTS "Admin Upload" ON storage.objects;
CREATE POLICY "Admin Upload Assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'assets' AND auth.role() = 'authenticated');

-- Storage Policies: Client Assets (Owner Access, Admin All)
-- We use path-based isolation: client-assets/UUID/file.ext
DROP POLICY IF EXISTS "Public Access Assets" ON storage.objects;
DROP POLICY IF EXISTS "Admin Upload Assets" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete Assets" ON storage.objects;

CREATE POLICY "Owner Access Client Assets" ON storage.objects FOR ALL 
USING (bucket_id = 'client-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admin Access Client Assets" ON storage.objects FOR ALL
USING (bucket_id = 'client-assets' AND auth.role() = 'authenticated');
