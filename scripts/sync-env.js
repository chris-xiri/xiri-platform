const fs = require('fs');
const path = require('path');

const rootEnvPath = path.resolve(__dirname, '../.env.local');

const apps = [
    path.resolve(__dirname, '../apps/dashboard'),
    path.resolve(__dirname, '../apps/public-site'),
];

const functionsDir = path.resolve(__dirname, '../packages/functions');

if (!fs.existsSync(rootEnvPath)) {
    console.log('⚠️  No root .env.local found. Creating a template...');
    const template = `NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
# Backend / Functions Keys
GEMINI_API_KEY=
SERPER_API_KEY=
TELEGRAM_BOT_TOKEN=
OPS_CHAT_ID=
SMTP_USER=
SMTP_PASS=
SMTP_HOST=
GCLOUD_PROJECT=
# Add your keys above
`;
    fs.writeFileSync(rootEnvPath, template);
    console.log('✅ Created root .env.local. Please fill it in.');
} else {
    console.log('🔄 Syncing .env.local to workspaces...');
    const envContent = fs.readFileSync(rootEnvPath, 'utf8');

    // 1. Sync to Apps (Full Copy)
    apps.forEach(dir => {
        if (fs.existsSync(dir)) {
            const targetPath = path.join(dir, '.env.local');
            fs.writeFileSync(targetPath, envContent);
            console.log(`   -> Apps: Synced to ${path.relative(process.cwd(), targetPath)}`);
        }
    });

    // 2. Sync to Functions (Create .secret.local for Emulator)
    if (fs.existsSync(functionsDir)) {
        const secretPath = path.join(functionsDir, '.secret.local');
        // We simply copy the whole env content.
        // Firebase Emulator > 10.x supports .secret.local loading for param:secrets
        fs.writeFileSync(secretPath, envContent);
        console.log(`   -> Functions: Synced to ${path.relative(process.cwd(), secretPath)}`);
    }

    console.log('✨ Environment sync complete.');
}
