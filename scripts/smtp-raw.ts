import net from 'net';

const host = '216.198.79.1';
const ports = [465, 587, 25];

console.log(`Starting RAW socket tests to ${host}...`);

function testConnection(port: number) {
    return new Promise((resolve) => {
        console.log(`\n--- Connecting to ${host}:${port} ---`);
        const socket = net.createConnection({ port, host, timeout: 10000 });

        socket.on('connect', () => {
            console.log(`✅ Socket CONNECTED to ${port}. Waiting for greeting...`);
        });

        socket.on('data', (data) => {
            console.log(`📩 GREETING RECEIVED on ${port}: ${data.toString().trim()}`);
            socket.end();
            resolve(true);
        });

        socket.on('timeout', () => {
            console.log(`❌ TIMEOUT on ${port}: No response within 10s.`);
            socket.destroy();
            resolve(false);
        });

        socket.on('error', (err) => {
            console.log(`❌ ERROR on ${port}: ${err.message}`);
            resolve(false);
        });
    });
}

async function run() {
    for (const port of ports) {
        await testConnection(port);
    }
    console.log('\nTests completed.');
}

run();
