-- RUN THIS IN YOUR SUPABASE SQL EDITOR --
-- This script formalizes the 7-role RBAC system.

-- 1. Sanitize Existing Data
-- Existing roles like 'Editor' must be mapped to the new schema before the constraint is applied.
UPDATE public.profiles SET role = 'Admin' WHERE role = 'Editor';
-- Default any other outliers to 'Client'
UPDATE public.profiles SET role = 'Client' WHERE role NOT IN ('Superadmin', 'Admin', 'CTO', 'Devs', 'Operations Officer', 'Sales Officer', 'Client');

-- 2. Update Profile Role Constraint
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN (
    'Superadmin', 
    'Admin', 
    'CTO', 
    'Devs', 
    'Operations Officer', 
    'Sales Officer', 
    'Client'
));

-- 2. Force-Elevate Superadmin Account
-- This ensures 'projects@cortdevs.com' has ultimate authority.
UPDATE public.profiles 
SET role = 'Superadmin',
    permissions = ARRAY[
        'Inventory', 
        'Intelligence', 
        'Dossier', 
        'Transactions', 
        'Settings', 
        'Security', 
        'Personnel', 
        'Projects'
    ]
WHERE email = 'projects@cortdevs.com';

-- 3. Adjust handle_new_user trigger for default roles
-- New signups default to 'Client' unless manually elevated by Superadmin.
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, permissions)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.email, 
    CASE 
        WHEN new.email = 'projects@cortdevs.com' THEN 'Superadmin'
        ELSE 'Client'
    END,
    CASE 
        WHEN new.email = 'projects@cortdevs.com' THEN ARRAY['Inventory', 'Intelligence', 'Dossier', 'Transactions', 'Settings', 'Security', 'Personnel', 'Projects']
        ELSE ARRAY['Projects']
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enable RLS and specific access for roles (Optional: advanced partitioning)
-- Note: Superadmins and Admins can see all. Devs see only assigned.
-- This part is usually handled via the application state, but database-level
-- enforcement is recommended for production.
