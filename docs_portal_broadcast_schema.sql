-- Broadcasts for document updates
CREATE TABLE IF NOT EXISTS public.doc_broadcasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_id UUID REFERENCES public.documentation(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category public.doc_category NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    target_roles TEXT[] DEFAULT '{}', -- List of roles that can see this (empty = everyone)
    is_active BOOLEAN DEFAULT TRUE
);

-- RLS for broadcasts
ALTER TABLE public.doc_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow role-based view of broadcasts" ON public.doc_broadcasts
    FOR SELECT USING (
        target_roles = '{}' OR 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = ANY(target_roles)
    );

-- Trigger to notify on new broadcast? 
-- Realtime handles this automatically in Supabase, but we can have a trigger if needed.
