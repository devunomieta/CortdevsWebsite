import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accountId = process.env.R2_ACCOUNT_ID || '';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'cortdevs-lms-private';

export function isR2Configured(): boolean {
    return Boolean(accountId && accessKeyId && secretAccessKey && R2_BUCKET_NAME);
}

let cachedClient: S3Client | null = null;

export function getR2Client(): S3Client | null {
    if (!isR2Configured()) return null;
    if (!cachedClient) {
        cachedClient = new S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            forcePathStyle: true,
            requestChecksumCalculation: 'WHEN_REQUIRED',
            responseChecksumValidation: 'WHEN_REQUIRED',
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
    }
    return cachedClient;
}

/**
 * Generates a short-lived (15 min default) pre-signed GET URL for a private R2 video.
 * Only called AFTER server-side sequential + Weekly Monday Drip checks pass.
 */
export async function signLessonVideoUrl(r2Key: string, expiresInSeconds = 900): Promise<string | null> {
    const client = getR2Client();
    if (!client || !r2Key) return null;

    const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        ResponseContentType: 'video/mp4',
        ResponseContentDisposition: 'inline',
    });

    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Generates a short-lived pre-signed GET URL for any private R2 object (e.g., reading images),
 * preserving the object's stored Content-Type header.
 */
export async function signR2AssetUrl(r2Key: string, expiresInSeconds = 1800): Promise<string | null> {
    const client = getR2Client();
    if (!client || !r2Key) return null;

    const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        ResponseContentDisposition: 'inline',
    });

    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

const R2_IMG_TOKEN_REGEX = /r2:\/\/(reading-images\/[a-zA-Z0-9._/-]+)/g;

/**
 * Replaces compact `r2://reading-images/...` tokens inside reading HTML with
 * short-lived pre-signed R2 HTTPS URLs (pure local HMAC signing, zero network calls).
 */
export async function resolveReadingHtmlImages(
    html: string | null | undefined,
    expiresInSeconds = 1800,
): Promise<string | null> {
    if (!html) return html ?? null;
    if (!html.includes('r2://reading-images/') || !isR2Configured()) return html;

    const uniqueKeys = new Set<string>();
    let match: RegExpExecArray | null;
    R2_IMG_TOKEN_REGEX.lastIndex = 0;
    while ((match = R2_IMG_TOKEN_REGEX.exec(html)) !== null) {
        uniqueKeys.add(match[1]);
    }
    if (uniqueKeys.size === 0) return html;

    const signedEntries = await Promise.all(
        Array.from(uniqueKeys).map(async (key) => {
            const url = await signR2AssetUrl(key, expiresInSeconds);
            return [key, url] as const;
        }),
    );

    const signedMap = new Map<string, string>();
    for (const [key, url] of signedEntries) {
        if (url) signedMap.set(key, url);
    }

    return html.replace(R2_IMG_TOKEN_REGEX, (full, key: string) => signedMap.get(key) || full);
}

export async function r2ObjectExists(r2Key: string): Promise<boolean> {
    const client = getR2Client();
    if (!client) return false;
    try {
        await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: r2Key }));
        return true;
    } catch {
        return false;
    }
}

export async function putR2Object(r2Key: string, body: any, contentType = 'video/mp4'): Promise<void> {
    const client = getR2Client();
    if (!client) throw new Error('Cloudflare R2 is not configured');
    await client.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        Body: body,
        ContentType: contentType,
    }));
}
