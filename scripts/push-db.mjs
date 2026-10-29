import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const rootDir = process.cwd();
const envLocalPath = path.join(rootDir, '.env.local');
const envPath = path.join(rootDir, '.env');

// Extract DATABASE_URL from .env.local or .env
function getDbUrl(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=')) {
      const val = trimmed.replace('DATABASE_URL=', '').trim().replace(/^["']|["']$/g, '');
      if (val) return val;
    }
  }
  return '';
}

const urlFromLocal = getDbUrl(envLocalPath);
const urlFromEnv = getDbUrl(envPath);
const finalDbUrl = urlFromLocal || urlFromEnv;

// Sync to .env so standard Prisma CLI tools always find it
if (finalDbUrl && fs.existsSync(envPath)) {
  let envContent = fs.readFileSync(envPath, 'utf-8');
  if (envContent.includes('DATABASE_URL=')) {
    envContent = envContent.replace(/DATABASE_URL=.*/, `DATABASE_URL="${finalDbUrl}"`);
  } else {
    envContent += `\nDATABASE_URL="${finalDbUrl}"\n`;
  }
  fs.writeFileSync(envPath, envContent, 'utf-8');
}

const isWin = process.platform === 'win32';
const cmd = isWin ? 'npx.cmd' : 'npx';

const result = spawnSync(cmd, ['prisma', 'db', 'push', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    ...(finalDbUrl ? { DATABASE_URL: finalDbUrl } : {}),
  },
});

process.exit(result.status ?? 0);
