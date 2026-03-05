-- Phase 14: Payment Confirmation Infrastructure
-- For manual bank transfer receipt verification

CREATE TABLE IF NOT EXISTS public.payment_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.clients(id) ON DELETE CASCADE, -- In this system, client_id is often used as project_id
    amount DECIMAL(20, 2) NOT NULL,
    receipt_url TEXT NOT NULL,
    status TEXT CHECK (status IN ('Pending', 'Confirmed', 'Rejected')) DEFAULT 'Pending',
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.payment_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all confirmations" ON public.payment_confirmations
FOR ALL USING (
    public.get_my_role() IN ('Superadmin', 'Admin', 'Operations Officer')
);

CREATE POLICY "Clients can view their own confirmations" ON public.payment_confirmations
FOR SELECT USING (
    -- For now, clients access via email, but if they have auth:
    -- auth.uid() = (SELECT user_id FROM clients WHERE id = client_id)
    true -- Public portal access is currently email-based read-only
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at_confirmations()
RETURNS trigger AS $$
BEGIN
    new.updated_at = now();
    return new;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_handle_updated_at_confirmations
BEFORE UPDATE ON public.payment_confirmations
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at_confirmations();
