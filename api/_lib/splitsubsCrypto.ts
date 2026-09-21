import crypto from 'crypto';

// Encrypts secrets an admin enters into the SplitSubs settings UI (Paystack
// live/test secret keys) so they're readable back out for API calls — same
// reversible AES-256-GCM approach as api/_lib/eventAuth.ts's credential
// storage, just keyed off its own secret so rotating one doesn't invalidate
// the other.
const ENC_SECRET = process.env.SPLITSUBS_ENCRYPTION_KEY || '';
if (!ENC_SECRET) {
    console.error('CRITICAL: SPLITSUBS_ENCRYPTION_KEY is missing from environment variables.');
}
const ENC_KEY = crypto.createHash('sha256').update(ENC_SECRET || 'insecure-dev-key-do-not-use-in-prod').digest();

export function encryptSecret(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(stored: string): string | null {
    try {
        const [ivB64, tagB64, dataB64] = stored.split('.');
        const iv = Buffer.from(ivB64, 'base64url');
        const authTag = Buffer.from(tagB64, 'base64url');
        const data = Buffer.from(dataB64, 'base64url');
        const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch {
        return null;
    }
}
