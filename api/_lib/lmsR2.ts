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
