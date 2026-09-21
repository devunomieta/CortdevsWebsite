import crypto from 'crypto';
import { supabase } from './supabase.js';
import { decryptSecret } from './splitsubsCrypto.js';

// Thin wrapper around the Paystack REST API. Live/Test key selection is a
// runtime decision (ss_platform_settings.paystack_mode), not a build-time one,
// per the PRD's "Live and Test key pairs... Admin Dashboard has a Live/Test
// mode switch" requirement — so every call here takes `mode` explicitly rather
// than reading a single baked-in key.
//
// The keys themselves can come from either the Admin Settings UI (encrypted
// in ss_platform_settings — see admin/splitsubs/settings.ts) or the
// PAYSTACK_LIVE_SECRET_KEY / PAYSTACK_TEST_SECRET_KEY env vars, in that order
// — env vars are the pre-deploy fallback so the platform still works before
// an admin has ever opened Settings.

const PAYSTACK_BASE = 'https://api.paystack.co';

export async function getPaystackSecretKey(mode: 'live' | 'test'): Promise<string> {
    const column = mode === 'live' ? 'paystack_live_secret_key_enc' : 'paystack_test_secret_key_enc';
    const { data } = await supabase.from('ss_platform_settings').select(column).eq('id', 1).maybeSingle();
    const encrypted = (data as any)?.[column] as string | null | undefined;
    if (encrypted) {
        const decrypted = decryptSecret(encrypted);
        if (decrypted) return decrypted;
    }

    const envKey = mode === 'live' ? process.env.PAYSTACK_LIVE_SECRET_KEY : process.env.PAYSTACK_TEST_SECRET_KEY;
    if (envKey) return envKey;

    throw new Error(`Paystack ${mode} secret key is not configured — set it in Admin Settings or the PAYSTACK_${mode.toUpperCase()}_SECRET_KEY env var.`);
}

interface PaystackEnvelope {
    status: boolean;
    message: string;
    data: any;
}

async function paystackFetch(mode: 'live' | 'test', path: string, init: RequestInit = {}): Promise<PaystackEnvelope> {
    const key = await getPaystackSecretKey(mode);
    const res = await fetch(`${PAYSTACK_BASE}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
    });
    const body = await res.json().catch(() => ({})) as Partial<PaystackEnvelope>;
    if (!res.ok || body.status === false) {
        throw new Error(body.message || `Paystack request failed (${res.status})`);
    }
    return body as PaystackEnvelope;
}

export async function initializeTransaction(mode: 'live' | 'test', params: {
    email: string;
    amountKobo: number;
    reference: string;
    callbackUrl?: string;
    metadata?: Record<string, unknown>;
}) {
    const body = await paystackFetch(mode, '/transaction/initialize', {
        method: 'POST',
        body: JSON.stringify({
            email: params.email,
            amount: params.amountKobo,
            reference: params.reference,
            callback_url: params.callbackUrl,
            metadata: params.metadata,
        }),
    });
    return body.data as { authorization_url: string; access_code: string; reference: string };
}

export async function verifyTransaction(mode: 'live' | 'test', reference: string) {
    const body = await paystackFetch(mode, `/transaction/verify/${encodeURIComponent(reference)}`);
    return body.data as { status: string; amount: number; reference: string; paid_at: string | null; gateway_response: string };
}

export async function resolveAccountNumber(mode: 'live' | 'test', accountNumber: string, bankCode: string) {
    const body = await paystackFetch(mode, `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`);
    return body.data as { account_number: string; account_name: string };
}

// Paystack's full Nigerian bank list — every commercial bank plus every
// licensed microfinance bank it settles NUBAN transfers to (Moniepoint MFB,
// Sparkle, Fairmoney MFB, etc.), not a hand-picked subset. type=nuban keeps
// the dropdown to accounts createTransferRecipient below can actually pay
// out to — Paystack's list also includes mobile-money-only entries that
// would resolve fine but fail at transfer-recipient creation.
export async function listBanks(mode: 'live' | 'test') {
    const body = await paystackFetch(mode, '/bank?country=nigeria&type=nuban');
    return body.data as { name: string; code: string; slug: string }[];
}

export async function createTransferRecipient(mode: 'live' | 'test', params: {
    name: string;
    accountNumber: string;
    bankCode: string;
}) {
    const body = await paystackFetch(mode, '/transferrecipient', {
        method: 'POST',
        body: JSON.stringify({
            type: 'nuban',
            name: params.name,
            account_number: params.accountNumber,
            bank_code: params.bankCode,
            currency: 'NGN',
        }),
    });
    return body.data as { recipient_code: string };
}

export async function createRefund(mode: 'live' | 'test', params: { transactionReference: string; amountKobo?: number; reason?: string }) {
    const body = await paystackFetch(mode, '/refund', {
        method: 'POST',
        body: JSON.stringify({
            transaction: params.transactionReference,
            amount: params.amountKobo, // omitted = full refund
            customer_note: params.reason,
        }),
    });
    return body.data as { status: string };
}

export async function initiateTransfer(mode: 'live' | 'test', params: {
    amountKobo: number;
    recipientCode: string;
    reason: string;
    reference: string;
}) {
    const body = await paystackFetch(mode, '/transfer', {
        method: 'POST',
        body: JSON.stringify({
            source: 'balance',
            amount: params.amountKobo,
            recipient: params.recipientCode,
            reason: params.reason,
            reference: params.reference,
        }),
    });
    return body.data as { transfer_code: string; status: string };
}

// Paystack signs webhook bodies with HMAC-SHA512 of the raw payload, keyed on
// the secret key for whichever mode sent it. We verify against both live and
// test secrets (DB-configured first, env var fallback) since a webhook can
// arrive for either mode and carries no separate "which key" flag beyond
// matching one of the two signatures.
export async function verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): Promise<'live' | 'test' | null> {
    if (!signatureHeader) return null;
    for (const mode of ['live', 'test'] as const) {
        let key: string;
        try {
            key = await getPaystackSecretKey(mode);
        } catch {
            continue;
        }
        const hash = crypto.createHmac('sha512', key).update(rawBody).digest('hex');
        if (hash === signatureHeader) return mode;
    }
    return null;
}
