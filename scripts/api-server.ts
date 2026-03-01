import http from 'http';
import path from 'path';
import fs from 'fs';
import { parse as parseUrl } from 'url';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

const PORT = 3000;

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

    const { pathname } = parseUrl(req.url || '', true);

    // Route /api/* to api/*.ts
    if (pathname?.startsWith('/api/')) {
        const routeName = pathname.replace('/api/', '');
        const filePath = path.join(process.cwd(), 'api', `${routeName}.ts`);

        if (fs.existsSync(filePath)) {
            try {
                // Import the handler dynamically
                const absolutePath = path.resolve(filePath);
                const module = await import(`file://${absolutePath}?update=${Date.now()}`);
                const handler = module.default;

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
                    res.statusCode = code;
                    return vercelRes;
                };

                vercelRes.json = (json: any) => {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(json));
                    return vercelRes;
                };

                await handler(vercelReq, vercelRes);
            } catch (error) {
                console.error(`Error in ${routeName}:`, error);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Internal Server Error', message: String(error) }));
            }
        } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not Found' }));
        }
    } else {
        res.statusCode = 404;
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`API Server running at http://localhost:${PORT}`);
});
