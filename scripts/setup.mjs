#!/usr/bin/env node
/**
 * Setup local: dependências, .env, Postgres (Docker), Prisma e migrações.
 * Uso: node scripts/setup.mjs   ou   pnpm setup
 */

import { spawn } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: 'inherit',
      shell: isWin,
      ...opts,
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`"${cmd} ${args.join(' ')}" saiu com código ${code}`));
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function checkCommand(cmd, args, hint) {
  try {
    await run(cmd, args, { stdio: 'pipe' });
    return true;
  } catch {
    console.error(`\n❌ Pré-requisito ausente: ${hint}\n`);
    process.exit(1);
  }
}

async function waitForPostgres(maxAttempts = 30) {
  console.log('\n⏳ Aguardando Postgres ficar pronto...');
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await run('docker', [
        'compose',
        'exec',
        '-T',
        'db',
        'pg_isready',
        '-U',
        'postgres',
        '-d',
        'gaius',
      ], { stdio: 'pipe' });
      console.log('✅ Postgres pronto.\n');
      return;
    } catch {
      if (i === maxAttempts) {
        console.error('❌ Postgres não respondeu a tempo. Verifique: docker compose logs db');
        process.exit(1);
      }
      await sleep(2000);
    }
  }
}

async function main() {
  console.log('\n🛠️  Gaius API — setup local\n');

  await checkCommand('node', ['--version'], 'Instale Node.js 20+ (https://nodejs.org)');
  await checkCommand('pnpm', ['--version'], 'Ative o pnpm: corepack enable && corepack prepare pnpm@9.15.4 --activate');
  await checkCommand('docker', ['--version'], 'Instale Docker Desktop (https://www.docker.com/products/docker-desktop/)');

  const envPath = join(root, '.env');
  const envExample = join(root, '.env.example');
  if (!existsSync(envPath)) {
    copyFileSync(envExample, envPath);
    console.log('📄 .env criado a partir de .env.example');
  } else {
    console.log('📄 .env já existe — mantido');
  }

  console.log('\n📦 Instalando dependências...\n');
  await run('pnpm', ['install', '--frozen-lockfile']);

  console.log('\n🐘 Subindo Postgres (Docker)...\n');
  await run('docker', ['compose', 'up', '-d', 'db']);
  await waitForPostgres();

  console.log('🔧 Prisma generate + migrate deploy...\n');
  await run('pnpm', ['exec', 'prisma', 'generate']);
  await run('pnpm', ['exec', 'prisma', 'migrate', 'deploy']);

  console.log('✅ Setup concluído!\n');
  console.log('Próximos passos:');
  console.log('  pnpm start:dev     → API em http://localhost:3000');
  console.log('  pnpm prisma:studio → interface do banco\n');
}

main().catch((err) => {
  console.error('\n❌ Setup falhou:', err.message);
  process.exit(1);
});
