import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const ports = [465, 587, 2525, 25];
const host = process.env.SMTP_HOST || 'mail.cortdevs.com';
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

async function testPort(port: number) {
    console.log(`\n--- Testing Port ${port} ---`);
    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        tls: { rejectUnauthorized: false }
    });

    try {
        await transporter.verify();
        console.log(`✅ SUCCESS: Port ${port} is open and verified.`);
    } catch (err: any) {
        console.error(`❌ FAILED: Port ${port} error: ${err.message}`);
    }
}

async function runTests() {
    console.log(`Starting SMTP diagnostics for ${host}...`);
    for (const port of ports) {
        await testPort(port);
    }
}

runTests();
