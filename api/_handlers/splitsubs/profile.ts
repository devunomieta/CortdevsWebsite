import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAuth } from '../../_lib/auth.js';
import { encryptSecret } from '../../_lib/splitsubsCrypto.js';
import { logSplitsubsActivity } from '../../_lib/splitsubsAuditLog.js';
import { isNonEmpty, withinLength, LIMITS } from '../../_lib/validation.js';

const NIN_RE = /^\d{11}$/;
// Vercel's serverless functions cap the whole request body around 4.5MB
// regardless of our custom bodyParser — base64 inflates a file by ~33%, so
// this stays well under that with room for the rest of the JSON payload.
const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;
const DOCUMENT_CONTENT_TYPES: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf',
};

// A data URL like "data:image/jpeg;base64,/9j/4AAQ..." — decoded and
// size-checked before it ever touches storage.
function decodeDocumentDataUrl(dataUrl: string): { buffer: Buffer; contentType: string; ext: string } | null {
    const match = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
    if (!match) return null;
    const [, contentType, base64] = match;
    const ext = DOCUMENT_CONTENT_TYPES[contentType];
    if (!ext) return null;
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_DOCUMENT_BYTES) return null;
    return { buffer, contentType, ext };
}

// GET  — the signed-in user's own profile: email (from the auth session,
//        never user-editable here), legal name, phone, KYC status.
// PATCH { legalName?, phone? } — editable any time except legalName while
//        KYC is 'approved' (changing it after approval would silently
//        invalidate what was actually verified — the bank-account name match).
// POST { action: 'submit_kyc', legalName, phone, idType: 'nin', idNumber, documentBase64 } —
//        opens (or reopens, after a rejection) a KYC review: the NIN number
//        plus a photo/scan of the physical slip (documentBase64, a data URL)
//        for a human reviewer to check against the typed name. BVN isn't
//        supported — self-serve KYC is NIN-only. Self-declared, admin-reviewed
//        — see admin/splitsubs/hosts.ts for approve/reject.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = await verifyAuth(req, res);
    if (!user) return;

    if (req.method === 'GET') {
        try {
            const { data: profile } = await supabase
                .from('ss_host_profiles')
                .select('legal_name, phone, kyc_status, kyc_id_type, kyc_document_path, kyc_submitted_at, kyc_reviewed_at, kyc_rejection_reason, verification_tier')
                .eq('id', user.id)
                .maybeSingle();
            return res.status(200).json({
                profile: {
                    email: user.email,
                    legal_name: null, phone: null,
                    kyc_status: 'unsubmitted', kyc_id_type: null, verification_tier: 'basic',
                    ...profile,
                    hasDocument: !!profile?.kyc_document_path,
                    kyc_document_path: undefined, // never sent to the client — reveal is admin-only, via a signed URL
                },
            });
        } catch (err: any) {
            console.error('splitsubs/profile get error:', err);
            return res.status(500).json({ error: 'Could not load your profile.' });
        }
    }

    if (req.method === 'PATCH') {
        const { legalName, phone } = req.body || {};
        try {
            const { data: existing } = await supabase.from('ss_host_profiles').select('kyc_status').eq('id', user.id).maybeSingle();
            const locked = existing?.kyc_status === 'approved';

            const patch: Record<string, unknown> = { id: user.id, email: user.email, updated_at: new Date().toISOString() };
            if (legalName !== undefined) {
                if (locked) return res.status(400).json({ error: 'Your name is locked after KYC approval — contact support if it needs to change.' });
                if (!isNonEmpty(legalName) || !withinLength(legalName, LIMITS.name)) return res.status(400).json({ error: `Legal name is required and must be ${LIMITS.name} characters or fewer.` });
                patch.legal_name = legalName.trim();
            }
            if (phone !== undefined) patch.phone = String(phone).trim() || null;

            await supabase.from('ss_host_profiles').upsert([patch], { onConflict: 'id' });
            return res.status(200).json({ success: true });
        } catch (err: any) {
            console.error('splitsubs/profile patch error:', err);
            return res.status(500).json({ error: err.message || 'Could not update your profile.' });
        }
    }

    if (req.method === 'POST') {
        const { action, legalName, phone, idType, idNumber, documentBase64 } = req.body || {};
        if (action !== 'submit_kyc') return res.status(400).json({ error: 'Unknown action.' });

        if (!isNonEmpty(legalName) || !withinLength(legalName, LIMITS.name)) return res.status(400).json({ error: 'Your full legal name is required.' });
        if (idType !== 'nin') return res.status(400).json({ error: 'Only NIN is supported for verification.' });
        if (!NIN_RE.test(String(idNumber || ''))) return res.status(400).json({ error: 'NIN must be exactly 11 digits.' });
        if (!isNonEmpty(documentBase64)) return res.status(400).json({ error: 'Upload a photo or scan of your NIN slip.' });

        const decoded = decodeDocumentDataUrl(documentBase64);
        if (!decoded) return res.status(400).json({ error: 'Your NIN slip must be a JPG, PNG, WEBP, or PDF under 3MB.' });

        try {
            const { data: existing } = await supabase.from('ss_host_profiles').select('kyc_status').eq('id', user.id).maybeSingle();
            if (existing?.kyc_status === 'approved') return res.status(400).json({ error: 'You are already KYC-verified.' });
            if (existing?.kyc_status === 'pending') return res.status(400).json({ error: 'Your KYC submission is already under review.' });

            const documentPath = `${user.id}/${Date.now()}.${decoded.ext}`;
            const { error: uploadError } = await supabase.storage
                .from('ss-kyc-docs')
                .upload(documentPath, decoded.buffer, { contentType: decoded.contentType, upsert: true });
            if (uploadError) throw uploadError;

            await supabase.from('ss_host_profiles').upsert([{
                id: user.id,
                email: user.email,
                legal_name: legalName.trim(),
                phone: phone ? String(phone).trim() : undefined,
                kyc_status: 'pending',
                kyc_id_type: 'nin',
                kyc_id_number_enc: encryptSecret(String(idNumber)),
                kyc_document_path: documentPath,
                kyc_submitted_at: new Date().toISOString(),
                kyc_reviewed_at: null,
                kyc_rejection_reason: null,
                updated_at: new Date().toISOString(),
            }], { onConflict: 'id' });

            await logSplitsubsActivity({
                actorType: existing ? 'host' : 'joiner', actorId: user.id, actorLabel: `${user.email}`,
                action: `Submitted KYC (NIN) for review`, targetType: 'host_profile', targetId: user.id,
            });

            return res.status(200).json({ success: true });
        } catch (err: any) {
            console.error('splitsubs/profile submit_kyc error:', err);
            return res.status(500).json({ error: err.message || 'Could not submit KYC.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
