#!/usr/bin/env node
/**
 * test-gps.mjs — prueba la Edge Function `gomezgps-gps` sin instalar nada.
 *
 * Uso (desde app/):
 *   node scripts/test-gps.mjs --email operacion@navegacolombia.com --password CLAVE
 *
 * Lee VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY de app/.env automáticamente
 * (o pásalas con --url y --anon).
 *
 * Qué hace:
 *   1. Login en Supabase Auth (email + password) → obtiene un JWT.
 *   2. Llama a la Edge Function con ese JWT (Authorization: Bearer).
 *   3. Imprime la respuesta: los barcos con su posición GPS.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, '');
    out[k] = argv[i + 1];
  }
  return out;
}

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && m[2]) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = loadEnv();
const args = parseArgs(process.argv.slice(2));
const url = (args.url ?? env.VITE_SUPABASE_URL ?? '').trim();
const anon = (args.anon ?? env.VITE_SUPABASE_ANON_KEY ?? '').trim();
const email = args.email;
const password = args.password;

if (!url || url.includes('TU_PROYECTO')) {
  console.error('❌ Falta VITE_SUPABASE_URL en app/.env (Project Settings → API → Project URL)');
  process.exit(1);
}
if (!anon || anon.includes('TU_CLAVE')) {
  console.error('❌ Falta VITE_SUPABASE_ANON_KEY en app/.env (Project Settings → API → anon public key)');
  process.exit(1);
}
if (!email || !password) {
  console.error('❌ Falta --email / --password (un usuario creado en Authentication → Users)');
  process.exit(1);
}

// 1) Login en Supabase Auth (endpoint REST, sin dependencias)
const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!res.ok) {
  console.error(`❌ Login en Supabase fallido (HTTP ${res.status}):`, await res.text());
  process.exit(1);
}
const { access_token: token } = await res.json();
console.log('✅ 1. Login Supabase OK — JWT obtenido');

// 2) Llamada a la Edge Function
const fn = await fetch(`${url}/functions/v1/gomezgps-gps`, {
  headers: { apikey: anon, Authorization: `Bearer ${token}` },
});
const body = await fn.json();
console.log(`✅ 2. Edge function respondió HTTP ${fn.status}`);
console.log(JSON.stringify(body, null, 2));

if (!body.ok) process.exit(1);
