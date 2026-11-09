import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const dashboardDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repoRoot = resolve(dashboardDir, '../..');
const themePath = join(dashboardDir, 'src', 'styles', 'theme.css');
const indexPath = join(dashboardDir, 'src', 'index.css');
const componentsPath = join(dashboardDir, 'components.json');
const packagePath = join(dashboardDir, 'package.json');

const preset = process.argv[2];
if (!preset) {
  console.error('Uso: pnpm --filter @porteria/dashboard theme:apply <preset-code|registry-url>');
  process.exit(1);
}

const isRegistryUrl = /^https?:\/\//i.test(preset);

const backupDir = join(os.tmpdir(), `porteria-theme-${Date.now()}`);
mkdirSync(backupDir, { recursive: true });

const files = [themePath, indexPath, componentsPath, packagePath];
for (const file of files) {
  cpSync(file, join(backupDir, file.split(/[\\/]/).pop()));
}

function restore() {
  for (const file of files) {
    cpSync(join(backupDir, file.split(/[\\/]/).pop()), file);
  }
}

function restoreIndexAndConfig() {
  for (const file of [indexPath, componentsPath, packagePath]) {
    cpSync(join(backupDir, file.split(/[\\/]/).pop()), file);
  }
}

function extractBlock(css, selector) {
  const pattern = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  return css.match(pattern)?.[1]?.trim() ?? '';
}

function pickTokens(block, names) {
  const tokens = new Map();
  for (const line of block.split(/\r?\n/)) {
    const match = line.trim().match(/^(--[a-z0-9-]+)\s*:\s*(.+);$/i);
    if (match && names.includes(match[1])) {
      tokens.set(match[1], line.trim());
    }
  }
  return [...tokens.values()].join('\n');
}

function customRootTokens(block) {
  return pickTokens(block, [
    '--destructive-foreground',
    '--warning',
    '--warning-foreground',
    '--warning-bg',
    '--font-ui',
    '--font-heading-font',
    '--font-code',
    '--font-sans',
    '--font-heading',
    '--font-mono',
  ]);
}

function customDarkTokens(block) {
  return pickTokens(block, [
    '--destructive-foreground',
    '--warning',
    '--warning-foreground',
    '--warning-bg',
  ]);
}

try {
  console.log(`Aplicando solo el tema del preset ${preset}...`);
  const shadcnArgs = isRegistryUrl
    ? ['dlx', 'shadcn@latest', 'add', preset, '-c', 'apps/dashboard', '-y']
    : [
        'dlx',
        'shadcn@latest',
        'apply',
        '--preset',
        preset,
        '-c',
        'apps/dashboard',
        '--only',
        'theme',
        '-y',
      ];
  execFileSync('pnpm', shadcnArgs, { cwd: repoRoot, stdio: 'inherit', shell: true });

  const currentTheme = readFileSync(themePath, 'utf8');
  const currentRootBlock = extractBlock(currentTheme, ':root');
  const currentDarkBlock = extractBlock(currentTheme, '.dark');
  const updatedIndex = readFileSync(indexPath, 'utf8');
  const rootBlock = extractBlock(updatedIndex, ':root');
  const darkBlock = extractBlock(updatedIndex, '.dark');

  if (!rootBlock || !darkBlock) {
    throw new Error('El CLI no generó los bloques :root y .dark esperados.');
  }

  const nextTheme = `:root {
  color-scheme: light;
${rootBlock}
${customRootTokens(currentRootBlock)}
}

.dark {
  color-scheme: dark;
${darkBlock}
${customDarkTokens(currentDarkBlock)}
}
`;

  writeFileSync(themePath, nextTheme, 'utf8');
  restoreIndexAndConfig();

  execFileSync('pnpm', ['--filter', '@porteria/dashboard', 'check:theme'], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: true,
  });
  execFileSync('pnpm', ['--filter', '@porteria/dashboard', 'exec', 'tsc', '--noEmit'], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: true,
  });

  console.log(`Tema aplicado. Backup: ${backupDir}`);
} catch (error) {
  restore();
  console.error('No se pudo aplicar el tema. Se restauró el estado anterior.');
  console.error(error instanceof Error ? error.message : error);
  console.error(`Backup: ${backupDir}`);
  process.exit(1);
}
