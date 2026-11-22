import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireLmsMember, sanitizeSingleLine } from '../../_lib/lmsGate.js';

const ALLOWED_LANGS = new Set(['en', 'en-US', 'en-GB', 'en-AU']);
const MAX_CHUNK_LEN = 180;
const MAX_CHUNKS = 8;

function splitTextIntoChunks(text: string): string[] {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    if (clean.length <= MAX_CHUNK_LEN) return [clean];

    const chunks: string[] = [];
    // Split on sentence boundaries first while keeping punctuation
    const sentences = clean.split(/(?<=[.!?])\s+/);

    let current = '';
    const pushPiece = (piece: string) => {
        if (!piece) return;
        if (piece.length <= MAX_CHUNK_LEN) {
            if (!current) {
                current = piece;
            } else if (current.length + 1 + piece.length <= MAX_CHUNK_LEN) {
                current = `${current} ${piece}`;
            } else {
                chunks.push(current);
                current = piece;
            }
            return;
        }
        // Long sentence without punctuation: split by commas/clauses, then words
        const words = piece.split(' ');
        for (const w of words) {
            const safeWord = w.slice(0, MAX_CHUNK_LEN);
            if (!current) {
                current = safeWord;
            } else if (current.length + 1 + safeWord.length <= MAX_CHUNK_LEN) {
                current = `${current} ${safeWord}`;
            } else {
                chunks.push(current);
                current = safeWord;
            }
        }
    };

    for (const s of sentences) {
        pushPiece(s.trim());
        if (chunks.length >= MAX_CHUNKS) break;
    }
    if (current && chunks.length < MAX_CHUNKS) {
        chunks.push(current);
    }
    return chunks.slice(0, MAX_CHUNKS);
}

async function fetchTtsChunk(chunk: string, lang: string): Promise<Buffer> {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(chunk)}`;
    const res = await fetch(url, {
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            Accept: 'audio/mpeg, audio/*;q=0.9, */*;q=0.5',
            Referer: 'https://translate.google.com/',
        },
        signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
        throw new Error(`TTS upstream error (${res.status})`);
    }
    const arrayBuf = await res.arrayBuffer();
    if (!arrayBuf || arrayBuf.byteLength < 100) {
        throw new Error('Empty audio received from TTS service');
    }
    return Buffer.from(arrayBuf);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const member = await requireLmsMember(req, res);
    if (!member) return;

    const rawText = sanitizeSingleLine(req.body?.text, 1200);
    if (!rawText || rawText.length < 2) {
        return res.status(400).json({ error: 'Text is required for audio synthesis.' });
    }

    const rawLang = typeof req.body?.lang === 'string' ? req.body.lang.trim() : 'en';
    const lang = ALLOWED_LANGS.has(rawLang) ? rawLang : 'en';

    const chunks = splitTextIntoChunks(rawText);
    if (!chunks.length) {
        return res.status(400).json({ error: 'No readable text provided.' });
    }

    try {
        const buffers: Buffer[] = [];
        for (const chunk of chunks) {
            const buf = await fetchTtsChunk(chunk, lang);
            buffers.push(buf);
        }
        const combined = Buffer.concat(buffers);
        return res.status(200).json({
            mimeType: 'audio/mpeg',
            audioBase64: combined.toString('base64'),
        });
    } catch (err: any) {
        console.error('[lms/tts] Audio synthesis failed:', err?.message || err);
        return res.status(503).json({
            error: 'Cloud audio voice is temporarily unavailable. Please try again in a moment.',
        });
    }
}
