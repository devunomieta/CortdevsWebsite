/**
 * Offloads all inline base64 images (`data:image/...;base64,...`) from
 * `public.lms_lessons.content_html` to private Cloudflare R2 (`reading-images/<sha256>.<ext>`)
 * and replaces them with compact `r2://reading-images/<sha256>.<ext>` tokens.
 *
 * Safe, idempotent, and resumable:
 *  - Deduplicates identical images by SHA-256 hash
 *  - Checks R2 via HeadObject before uploading
 *  - Updates one lesson row at a time so Postgres/PostgREST never times out
 *
 * Usage:
 *   npx tsx scripts/offload-reading-images-to-r2.ts
 */

import 'dotenv/config';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET_NAME || 'cortdevs-lms-private';

if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}
if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY in .env');
}

const supabase = createClient(supabaseUrl, serviceKey);
const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: { accessKeyId, secretAccessKey },
});

const DATA_IMG_REGEX = /data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)/g;

function extensionFromMime(mime: string): string {
    const clean = mime.toLowerCase().split(';')[0].trim();
    if (clean === 'image/jpeg' || clean === 'image/jpg') return 'jpg';
    if (clean === 'image/png') return 'png';
    if (clean === 'image/webp') return 'webp';
    if (clean === 'image/gif') return 'gif';
    if (clean === 'image/svg+xml') return 'svg';
    if (clean === 'image/bmp') return 'bmp';
    if (clean === 'image/tiff') return 'tiff';
    return 'png';
}

const knownInR2 = new Set<string>();

async function ensureUploadedToR2(r2Key: string, buf: Buffer, contentType: string): Promise<'uploaded' | 'existed'> {
    if (knownInR2.has(r2Key)) return 'existed';

    try {
        await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: r2Key }));
        knownInR2.add(r2Key);
        return 'existed';
    } catch (err: any) {
        const status = err?.$metadata?.httpStatusCode;
        const name = err?.name || '';
        if (status !== 404 && name !== 'NotFound' && name !== 'NoSuchKey') {
            throw err;
        }
    }

    await r2.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: r2Key,
            Body: buf,
            ContentLength: buf.length,
            ContentType: contentType,
            CacheControl: 'public, max-age=31536000, immutable',
        }),
    );
    knownInR2.add(r2Key);
    return 'uploaded';
}

async function main() {
    console.log('Fetching lesson index from Supabase...');
    const { data: lessonIndex, error: idxErr } = await supabase
        .from('lms_lessons')
        .select('id, slug, lesson_type')
        .order('global_order', { ascending: true });

    if (idxErr || !lessonIndex) {
        throw new Error(`Failed to fetch lms_lessons index: ${idxErr?.message}`);
    }

    console.log(`Scanning ${lessonIndex.length} lessons for inline base64 images...`);

    let totalBeforeBytes = 0;
    let totalAfterBytes = 0;
    let lessonsUpdated = 0;
    let totalImagesFound = 0;
    let uniqueImagesUploaded = 0;
    let imagesReused = 0;
    let r2UploadedBytes = 0;

    for (let i = 0; i < lessonIndex.length; i++) {
        const meta = lessonIndex[i];
        const { data: row, error: rowErr } = await supabase
            .from('lms_lessons')
            .select('id, content_html')
            .eq('id', meta.id)
            .single();

        if (rowErr || !row) {
            console.warn(`  [warn] Skipped ${meta.slug}: ${rowErr?.message}`);
            continue;
        }

        const html = row.content_html || '';
        const beforeBytes = Buffer.byteLength(html, 'utf8');
        totalBeforeBytes += beforeBytes;

        if (!html.includes('data:image/')) {
            totalAfterBytes += beforeBytes;
            continue;
        }

        // Collect all matches in this lesson
        const replacements: Array<{ full: string; r2Key: string; contentType: string; buf: Buffer }> = [];
        DATA_IMG_REGEX.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = DATA_IMG_REGEX.exec(html)) !== null) {
            const full = m[0];
            const contentType = m[1].toLowerCase();
            const b64 = m[2].replace(/\s+/g, '');
            const buf = Buffer.from(b64, 'base64');
            const ext = extensionFromMime(contentType);
            const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 24);
            const r2Key = `reading-images/${hash}.${ext}`;
            replacements.push({ full, r2Key, contentType, buf });
        }

        if (replacements.length === 0) {
            totalAfterBytes += beforeBytes;
            continue;
        }

        totalImagesFound += replacements.length;

        // Deduplicate uploads within this lesson and upload in parallel (concurrency 4)
        const uniqueInLesson = new Map<string, { buf: Buffer; contentType: string }>();
        for (const rep of replacements) {
            if (!uniqueInLesson.has(rep.r2Key)) {
                uniqueInLesson.set(rep.r2Key, { buf: rep.buf, contentType: rep.contentType });
            }
        }

        const entries = Array.from(uniqueInLesson.entries());
        for (let k = 0; k < entries.length; k += 4) {
            const chunk = entries.slice(k, k + 4);
            const statuses = await Promise.all(
                chunk.map(async ([r2Key, item]) => {
                    const st = await ensureUploadedToR2(r2Key, item.buf, item.contentType);
                    return { st, size: item.buf.length };
                }),
            );
            for (const { st, size } of statuses) {
                if (st === 'uploaded') {
                    uniqueImagesUploaded += 1;
                    r2UploadedBytes += size;
                } else {
                    imagesReused += 1;
                }
            }
        }

        // Replace data:image/... strings with compact r2:// tokens
        DATA_IMG_REGEX.lastIndex = 0;
        let idx = 0;
        const cleanedHtml = html.replace(DATA_IMG_REGEX, () => {
            const rep = replacements[idx++];
            return `r2://${rep.r2Key}`;
        });

        const afterBytes = Buffer.byteLength(cleanedHtml, 'utf8');
        totalAfterBytes += afterBytes;

        const { error: upErr } = await supabase
            .from('lms_lessons')
            .update({ content_html: cleanedHtml })
            .eq('id', meta.id);

        if (upErr) {
            throw new Error(`Failed to update lesson ${meta.slug}: ${upErr.message}`);
        }

        lessonsUpdated += 1;
        if (lessonsUpdated % 20 === 0 || beforeBytes > 2_000_000) {
            console.log(
                `  [${i + 1}/${lessonIndex.length}] ${meta.slug}: ${(beforeBytes / 1024).toFixed(0)} KB -> ${(afterBytes / 1024).toFixed(1)} KB (${replacements.length} imgs)`,
            );
        }
    }

    console.log('\n=== OFFLOAD COMPLETE ===');
    console.log(`Lessons updated:          ${lessonsUpdated} / ${lessonIndex.length}`);
    console.log(`Inline images extracted:  ${totalImagesFound}`);
    console.log(`Unique uploaded to R2:    ${uniqueImagesUploaded} (${(r2UploadedBytes / 1048576).toFixed(2)} MB)`);
    console.log(`Deduplicated / reused:    ${imagesReused}`);
    console.log(`Postgres content_html:    ${(totalBeforeBytes / 1048576).toFixed(2)} MB -> ${(totalAfterBytes / 1048576).toFixed(2)} MB`);
    console.log('\nNEXT STEP: Run this 1-line SQL in Supabase SQL Editor to reclaim disk space immediately:');
    console.log('  VACUUM FULL public.lms_lessons;');
}

main().catch((err) => {
    console.error('Offload failed:', err);
    process.exit(1);
});
