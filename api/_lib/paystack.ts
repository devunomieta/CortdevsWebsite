import crypto from 'crypto';

// Thin wrapper around the Paystack REST API. Live/Test key selection is a
// runtime decision (ss_platform_settings.paystack_mode), not a build-time one,
// per the PRD's "Live and Test key pairs... Admin Dashboard has a Live/Test
// mode switch" requirement — so every call here takes `mode` explicitly rather
// than reading a single baked-in key.

const PAYSTACK_BASE = 'https://api.paystack.co';

function keyFor(mode: 'live' | 'test'): string {
    const key = mode === 'live' ? process.env.PAYSTACK_LIVE_SECRET_KEY : process.env.PAYSTACK_TEST_SECRET_KEY;
    if (!key) {
        throw new Error(`Paystack ${mode} secret key is not configured.`);
    }
    return key;
}

async function paystackFetch(mode: 'live' | 'test', path: string, init: RequestInit = {}) {
    const res = await fetch(`${PAYSTACK_BASE}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${keyFor(mode)}`,
            'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.status === false) {
        throw new Error(body.message || `Paystack request failed (${res.status})`);
    }
    return body;
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

export async function listBanks(mode: 'live' | 'test') {
    const body = await paystackFetch(mode, '/bank?country=nigeria');
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
// test secrets since a webhook can arrive for either mode and carries no
// separate "which key" flag beyond matching one of the two signatures.
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): 'live' | 'test' | null {
    if (!signatureHeader) return null;
    for (const mode of ['live', 'test'] as const) {
        const key = mode === 'live' ? process.env.PAYSTACK_LIVE_SECRET_KEY : process.env.PAYSTACK_TEST_SECRET_KEY;
        if (!key) continue;
        const hash = crypto.createHmac('sha512', key).update(rawBody).digest('hex');
        if (hash === signatureHeader) return mode;
    }
    return null;
}
