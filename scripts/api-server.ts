import http from 'http';
import path from 'path';
import { pathToFileURL } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

const PORT = 3000;

// Prevent server crash on unhandled errors
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});

const server = http.createServer(async (req, res) => {
    // Basic CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const host = req.headers.host || 'localhost';
    const url = new URL(req.url || '', `http://${host}`);
    const pathname = url.pathname;

    // Route /api/* to api/*.ts
    if (pathname.startsWith('/api/')) {
        const routeName = pathname.replace('/api/', '');
        const filePath = path.join(process.cwd(), 'api', `${routeName}.ts`);

        if (fs.existsSync(filePath)) {
            let bodySent = false;
            try {
                // Import the handler dynamically
                const absolutePath = path.resolve(filePath);
                const fileUrl = pathToFileURL(absolutePath);
                fileUrl.searchParams.set('update', Date.now().toString());
                const module = await import(fileUrl.href);
                const handler = module.default;

                if (typeof handler !== 'function') {
                    throw new Error(`Handler in ${routeName} is not a function (check default export)`);
                }

                // Mock VercelRequest and VercelResponse
                const vercelReq = req as any;
                const vercelRes = res as any;

                // Simple JSON body parser for POST
                if (req.method === 'POST') {
                    const buffers: Buffer[] = [];
                    for await (const chunk of req) {
                        buffers.push(chunk);
                    }
                    const data = Buffer.concat(buffers).toString();
                    try {
                        vercelReq.body = JSON.parse(data);
                    } catch (e) {
                        vercelReq.body = {};
                    }
                }

                vercelRes.status = (code: number) => {
                    if (!bodySent) res.statusCode = code;
                    return vercelRes;
                };

                vercelRes.json = (json: any) => {
                    if (bodySent) return vercelRes;
                    bodySent = true;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(json));
                    return vercelRes;
                };

                // Vercel-like send (fallback)
                vercelRes.send = (data: any) => {
                    if (bodySent) return vercelRes;
                    bodySent = true;
                    res.end(typeof data === 'string' ? data : JSON.stringify(data));
                    return vercelRes;
                };

                await handler(vercelReq, vercelRes);
            } catch (error) {
                console.error(`Error in ${routeName}:`, error);
                if (!bodySent) {
                    bodySent = true;
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        error: 'Intelligence Link Failure',
                        message: String(error)
                    }));
                }
            }
        } else {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Endpoint Not Found' }));
        }
    } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Not Found' }));
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`API Server running at http://127.0.0.1:${PORT}`);
});
