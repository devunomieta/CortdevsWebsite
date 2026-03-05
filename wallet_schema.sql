-- RUN THIS IN YOUR SUPABASE SQL EDITOR --
-- Phase 12: Financial Ecosystem Infrastructure (Wallets & Treasury)

-- 1. Wallets Table
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE, -- To support easy lookup
    balance DECIMAL(20, 2) DEFAULT 0.00,
    currency TEXT DEFAULT 'USD',
    type TEXT CHECK (type IN ('Central', 'Personnel')) DEFAULT 'Personnel',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Wallet Transactions Table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE,
    amount DECIMAL(20, 2) NOT NULL,
    type TEXT CHECK (type IN ('Credit', 'Debit')) NOT NULL,
    category TEXT, -- e.g., 'Project Payment', 'Commission', 'Salary', 'Withdrawal'
    description TEXT,
    reference_id UUID, -- Link to client_id or project_id if applicable
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Payment Gateways Table (Admin Config)
CREATE TABLE IF NOT EXISTS public.payment_gateways (
    id TEXT PRIMARY KEY, -- 'paystack', 'stripe', 'paypal', 'bank_transfer'
    name TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}', -- Store keys, status, etc.
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Initial Gateways Setup
INSERT INTO public.payment_gateways (id, name, is_enabled)
VALUES 
    ('paystack', 'Paystack', true),
    ('stripe', 'Stripe', true),
    ('paypal', 'PayPal', true),
    ('bank_transfer', 'Bank Transfer', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Enable RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

-- 6. Central Treasury Policy
-- Only Superadmins and Admins can see all wallets
CREATE POLICY "Admins can view all wallets" ON public.wallets
FOR SELECT USING (
    public.get_my_role() IN ('Superadmin', 'Admin')
);

-- Users can see their own wallet
CREATE POLICY "Users can view own wallet" ON public.wallets
FOR SELECT USING (auth.uid() = user_id);

-- 7. Wallet Initialization Trigger
-- Automatically create a wallet for every PERSONNEL registered in profiles
CREATE OR REPLACE FUNCTION public.initialize_personnel_wallet()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.wallets (user_id, email, type)
    VALUES (new.id, new.email, 'Personnel')
    ON CONFLICT (email) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_wallet ON public.profiles;
CREATE TRIGGER on_profile_created_wallet
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.initialize_personnel_wallet();

-- 8. Initialize Wallets for existing Personnel
INSERT INTO public.wallets (user_id, email, type)
SELECT id, email, 'Personnel' FROM public.profiles
ON CONFLICT (email) DO NOTHING;

-- Force 'projects@cortdevs.com' wallet to be 'Central'
UPDATE public.wallets SET type = 'Central' WHERE email = 'projects@cortdevs.com';

-- 9. Verification Query
SELECT email, balance, type FROM public.wallets;
