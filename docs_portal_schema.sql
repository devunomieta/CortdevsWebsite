-- Docs Portal Schema Expansion
-- Enables role-based documentation management and gated submissions

-- 1. Categories Enum
DO $$ BEGIN
    CREATE TYPE doc_category AS ENUM ('Public Docs', 'Tech Docs', 'Analysis', 'Employment Docs', 'Brand Docs');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Master Documentation table
CREATE TABLE IF NOT EXISTS public.documentation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category doc_category NOT NULL,
    file_url TEXT NOT NULL, -- Path to Supabase Storage
    file_type TEXT, -- pdf, md, docx
    size INTEGER,
    uploaded_by UUID REFERENCES auth.users(id),
    is_internal BOOLEAN DEFAULT false, -- Extra flag for tech/internal only
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Document Submissions (Upload Box for Superadmin review)
CREATE TABLE IF NOT EXISTS public.documentation_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category doc_category NOT NULL,
    file_url TEXT NOT NULL,
    submitted_by UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'Pending', -- Pending, Approved, Downloaded
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS Policies

ALTER TABLE public.documentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentation_submissions ENABLE ROW LEVEL SECURITY;

-- Documentation Policies:
-- Public/Brand: Everyone can read
CREATE POLICY "Public docs are readable by anyone" ON public.documentation
FOR SELECT USING (category IN ('Public Docs', 'Brand Docs'));

-- Tech/Analysis: Superadmin, Admin, CTO, Devs
CREATE POLICY "Internal docs are readable by tech roles" ON public.documentation
FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Superadmin', 'Admin', 'CTO', 'Devs')
    AND category IN ('Tech Docs', 'Analysis')
);

-- Employment: All roles EXCEPT Client
CREATE POLICY "Employment docs are readable by staff" ON public.documentation
FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('Client')
    AND category = 'Employment Docs'
);

-- Upload Policy: Only Superadmin can INSERT into documentation
CREATE POLICY "Only Superadmin can upload directly" ON public.documentation
FOR INSERT WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Superadmin'
);

-- Submissions Policies:
-- Anyone NOT a Client can submit
CREATE POLICY "Staff can submit docs for review" ON public.documentation_submissions
FOR INSERT WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('Client')
);

-- Only Superadmin can see submissions
CREATE POLICY "Only Superadmin can view/manage submissions" ON public.documentation_submissions
FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Superadmin'
);

-- 5. Social Features: Likes & Comments
CREATE TABLE IF NOT EXISTS public.doc_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID REFERENCES public.documentation(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(doc_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.doc_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID REFERENCES public.documentation(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.doc_comments(id) ON DELETE CASCADE, -- For replies
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Social RLS Policies
ALTER TABLE public.doc_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_comments ENABLE ROW LEVEL SECURITY;

-- Likes: Readable by anyone who can see the doc, Insertable by authenticated staff
CREATE POLICY "Likes are readable by doc viewers" ON public.doc_likes
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.documentation WHERE id = doc_id)
);

CREATE POLICY "Staff can like docs" ON public.doc_likes
FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('Client')
);

CREATE POLICY "Users can unlike their own likes" ON public.doc_likes
FOR DELETE USING (auth.uid() = user_id);

-- Comments: Readable by anyone who can see the doc, Manageable by author or Superadmin
CREATE POLICY "Comments are readable by doc viewers" ON public.doc_comments
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.documentation WHERE id = doc_id)
);

CREATE POLICY "Staff can comment on docs" ON public.doc_comments
FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('Client')
);

CREATE POLICY "Users can manage their own comments" ON public.doc_comments
FOR ALL USING (
    auth.uid() = user_id OR 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Superadmin'
);

-- 7. Issue Tracking System
CREATE TYPE issue_status AS ENUM ('Open', 'In Progress', 'Resolved', 'Closed');

CREATE TABLE IF NOT EXISTS public.portal_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID REFERENCES public.documentation(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status issue_status DEFAULT 'Open',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.issue_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID REFERENCES public.portal_issues(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false, -- For private admin notes
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Issue RLS Policies
ALTER TABLE public.portal_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_messages ENABLE ROW LEVEL SECURITY;

-- Issues: Reporters see their own, Superadmins see all
CREATE POLICY "Users can view and create their own issues" ON public.portal_issues
FOR ALL USING (
    auth.uid() = user_id OR 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Superadmin'
);

-- Messages: Users can see messages on their issues
CREATE POLICY "Users can view messages on their issues" ON public.issue_messages
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.portal_issues 
        WHERE id = issue_id AND (user_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Superadmin')
    )
);

CREATE POLICY "Users can reply to their issues" ON public.issue_messages
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.portal_issues 
        WHERE id = issue_id AND (user_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Superadmin')
    )
);

-- 9. Storage Bucket (Recommended Manual Creation in Supabase Dashboard)
-- Bucket ID: "documentation"
-- Policy: Public access for 'public-docs' subfolder, Auth access for others.
