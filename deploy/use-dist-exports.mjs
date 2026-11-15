// Apunta los paquetes del workspace a su build compilado.
//
// En desarrollo los paquetes exportan `src/*.ts` a propósito: tsx y Vite saben
// compilar TypeScript al vuelo, y así un cambio en el esquema se refleja sin
// recompilar. En el contenedor corre `node` puro, que no puede importar .ts.
//
// Este script reescribe los package.json dentro de la imagen para que el runtime
// resuelva `dist/`. Se ejecuta sólo en el build de Docker, así que el flujo de
// desarrollo queda intacto.

import { readFileSync, writeFileSync } from 'node:fs';

const packages = [
  {
    file: 'packages/database/package.json',
    exports: {
      '.': './dist/index.js',
      './schema': './dist/schema/index.js',
    },
  },
  {
    file: 'packages/shared/package.json',
    exports: {
      '.': './dist/index.js',
    },
  },
];

for (const { file, exports } of packages) {
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  pkg.main = './dist/index.js';
  pkg.types = './dist/index.d.ts';
  pkg.exports = exports;
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`[docker] ${file} ahora apunta a dist/`);
}
