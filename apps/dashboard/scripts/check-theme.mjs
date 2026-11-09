import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src', import.meta.url));
const allowedThemeFile = join(root, 'styles', 'theme.css');
const extensions = new Set(['.ts', '.tsx', '.css']);
const violations = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const filePath = join(directory, entry);
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      walk(filePath);
      continue;
    }
    if (!extensions.has(filePath.slice(filePath.lastIndexOf('.')))) continue;
    if (filePath === allowedThemeFile) continue;
    inspect(filePath);
  }
}

function inspect(filePath) {
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/#[0-9a-fA-F]{3,8}\b/.test(line) || /\brgba?\(/.test(line) || /\boklch\(/.test(line)) {
      violations.push(`${relative(root, filePath)}:${index + 1} raw color: ${line.trim()}`);
    }
    if (/fonts\.googleapis/.test(line)) {
      violations.push(`${relative(root, filePath)}:${index + 1} runtime Google Fonts import`);
    }
    if (/font-family\s*:\s*['"](?!var\()/.test(line)) {
      violations.push(`${relative(root, filePath)}:${index + 1} raw font family: ${line.trim()}`);
    }
  });
}

walk(root);

if (violations.length > 0) {
  console.error('Theme validation failed:\n');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Theme validation OK: no raw colors, font families, or Google Fonts outside theme.css.');
