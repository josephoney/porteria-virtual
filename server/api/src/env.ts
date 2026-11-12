import dotenv from 'dotenv';
import path from 'node:path';

// Loaded from its own module so it runs before `config.ts` is evaluated.
// ESM evaluates every static import before the importing module body, so
// calling dotenv.config() inside index.ts left `config` reading the raw
// process environment and silently ignoring the .env file.
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
