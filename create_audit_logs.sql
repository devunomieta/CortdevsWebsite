-- RUN THIS IN YOUR SUPABASE SQL EDITOR --

-- 1. Ensure Profiles table has necessary columns
DO $$ 
BEGIN 
    -- Add avatar_url if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN
        ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
    END IF;
    
    -- Add role if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='role') THEN
        ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'Editor';
    END IF;

    -- Add permissions if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='permissions') THEN
        ALTER TABLE profiles ADD COLUMN permissions TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- 2. Create Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    target_type TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    severity TEXT DEFAULT 'Normal',
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Policies for Audit Logs
DROP POLICY IF EXISTS "Admins can view all logs" ON audit_logs;
CREATE POLICY "Admins can view all logs" ON audit_logs 
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "System can insert logs" ON audit_logs;
CREATE POLICY "System can insert logs" ON audit_logs 
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 5. Trigger for automated profile creation (Optional but recommended)
-- This ensures every new signup gets a profile entry automatically
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, 'Editor');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
