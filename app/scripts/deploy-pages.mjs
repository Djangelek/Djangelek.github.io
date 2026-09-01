/**
 * deploy-pages.mjs — publica el build de la app en la carpeta navega/
 * del repo (GitHub Pages). Uso: npm run deploy:pages
 * La app usa base './' y HashRouter, así que funciona en
 * https://<usuario>.github.io/navega/ sin más configuración.
 */
import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(appDir, 'dist');
const dest = path.resolve(appDir, '..', 'navega');

await rm(dest, { recursive: true, force: true });
await cp(src, dest, { recursive: true });
console.log(`✔ dist → ${dest}`);
