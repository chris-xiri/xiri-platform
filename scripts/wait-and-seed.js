const net = require('net');
const { spawn } = require('child_process');
const path = require('path');

const AUTH_PORT = 9099;
const FIRESTORE_PORT = 8085;
const MAX_RETRIES = 30; // 30 seconds
const RETRY_INTERVAL = 1000;

function checkPort(port) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();

        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });

        socket.on('error', (err) => {
            socket.destroy();
            reject(err);
        });

        socket.on('timeout', () => {
            socket.destroy();
            reject(new Error('Timeout'));
        });

        socket.connect(port, '127.0.0.1');
    });
}

async function waitForEmulators() {
    console.log('⏳ Waiting for Firebase Emulators to start...');

    let retries = 0;
    while (retries < MAX_RETRIES) {
        try {
            await Promise.all([
                checkPort(AUTH_PORT),
                checkPort(FIRESTORE_PORT)
            ]);
            console.log('✅ Emulators are up!');
            return true;
        } catch (e) {
            retries++;
            await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
        }
    }
    console.error('❌ Emulators failed to start in time.');
    return false;
}

async function runScript(scriptName) {
    return new Promise((resolve, reject) => {
        console.log(`🌱 Running ${scriptName}...`);
        const scriptPath = path.join(__dirname, scriptName);
        const proc = spawn('node', [scriptPath], { stdio: 'inherit' });

        proc.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ ${scriptName} complete.`);
                resolve();
            } else {
                console.error(`❌ ${scriptName} failed with code ${code}.`);
                reject(new Error(`Script failed: ${scriptName}`));
            }
        });
    });
}

async function main() {
    const ready = await waitForEmulators();
    if (!ready) process.exit(1);

    // Initial delay to ensure not just the port is open but services are initializing
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
        await runScript('seed-users.js');
        await runScript('seed-templates.js');
        console.log('✨ All seeding complete!');
    } catch (e) {
        console.error('Seeding failed:', e);
        process.exit(1);
    }
}

main();
