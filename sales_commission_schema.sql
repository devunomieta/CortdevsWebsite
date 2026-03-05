-- RUN THIS IN YOUR SUPABASE SQL EDITOR --
-- Phase 13: Sales Attribution & Commission Infrastructure

-- 1. Extend Leads & Clients with Attribution
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS onboarded_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS onboarded_by UUID REFERENCES public.profiles(id);

-- 2. Commissions Table
CREATE TABLE IF NOT EXISTS public.commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_officer_id UUID REFERENCES public.profiles(id) NOT NULL,
    client_id UUID REFERENCES public.clients(id) NOT NULL,
    amount DECIMAL(20, 2) NOT NULL,
    status TEXT CHECK (status IN ('Pending', 'Approved', 'Paid')) DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Extend Profiles for Sales Config
-- Adding commission percentage to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 2) DEFAULT 10.00;

-- 4. Unified Ledger Synchronization (Wallet -> Transactions)
-- This function ensures all wallet movements are reflected in the main auditing ledger
CREATE OR REPLACE FUNCTION public.sync_wallet_to_ledger()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.transactions (
        client_id, -- Can be null for personnel withdrawals
        type, -- Income or Expense
        amount,
        description,
        category,
        status,
        date
    )
    VALUES (
        new.reference_id, -- Link if provided
        CASE WHEN new.type = 'Credit' THEN 'Income' ELSE 'Expense' END,
        ABS(new.amount),
        COALESCE(new.description, 'Wallet Movement Sync'),
        COALESCE(new.category, 'Wallet Settlement'),
        'Completed',
        now()
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_wallet_to_ledger ON public.wallet_transactions;
CREATE TRIGGER tr_sync_wallet_to_ledger
AFTER INSERT ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_wallet_to_ledger();

-- 5. RLS Security Polish for Sales Officers
-- Leads: Only see your own
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sales Officers see their own leads" ON public.leads;
CREATE POLICY "Sales Officers see their own leads" ON public.leads
FOR SELECT USING (
    (public.get_my_role() IN ('Superadmin', 'Admin', 'Operations Officer', 'Sales Officer')) 
    AND 
    (CASE WHEN public.get_my_role() = 'Sales Officer' THEN onboarded_by = auth.uid() ELSE true END)
);

-- Clients: Only see your own
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sales Officers see their own clients" ON public.clients;
CREATE POLICY "Sales Officers see their own clients" ON public.clients
FOR SELECT USING (
    (public.get_my_role() IN ('Superadmin', 'Admin', 'Operations Officer', 'Sales Officer')) 
    AND 
    (CASE WHEN public.get_my_role() = 'Sales Officer' THEN onboarded_by = auth.uid() ELSE true END)
);

-- 6. Verification
SELECT 'Phase 13 Infrastructure Deployment Initialized' as status;
