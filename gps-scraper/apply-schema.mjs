#!/usr/bin/env node
/**
 * apply-schema.mjs — ejecuta un archivo SQL en un proyecto Supabase
 * sentencia por sentencia a través de la Management API (igual que el SQL
 * Editor del dashboard). Usa el token personal (SUPABASE_ACCESS_TOKEN).
 *
 * Uso: SUPABASE_ACCESS_TOKEN=sbp_... node apply-schema.mjs <project_ref> [archivo.sql]
 *   (si no se pasa archivo, usa app/supabase/schema.sql)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REF = process.argv[2];
const FILE = process.argv[3] ?? path.join(__dirname, '..', 'app', 'supabase', 'schema.sql');
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!REF || !TOKEN) {
  console.error('Uso: SUPABASE_ACCESS_TOKEN=sbp_... node apply-schema.mjs <project_ref> [archivo.sql]');
  process.exit(1);
}

const sql = fs.readFileSync(FILE, 'utf8');

/** Divide el SQL en sentencias respetando $$...$$, '...' y comentarios. */
function splitStatements(src) {
  const out = [];
  let cur = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    const next = src.slice(i, i + 2);
    if (next === '--') { // comentario de línea
      const eol = src.indexOf('\n', i);
      i = eol === -1 ? src.length : eol + 1;
      continue;
    }
    if (next === '/*') { // comentario de bloque
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (ch === "'") { // string literal
      cur += ch; i++;
      while (i < src.length) {
        if (src[i] === "'") {
          if (src[i + 1] === "'") { cur += "''"; i += 2; continue; }
          cur += "'"; i++; break;
        }
        cur += src[i]; i++;
      }
      continue;
    }
    if (next === '$$') { // dollar-quote (funciones/triggers)
      const end = src.indexOf('$$', i + 2);
      cur += src.slice(i, end + 2);
      i = end + 2;
      continue;
    }
    if (ch === ';') {
      const stmt = cur.trim();
      if (stmt) out.push(stmt);
      cur = '';
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  const tail = cur.trim();
  if (tail) out.push(tail);
  return out;
}

const stmts = splitStatements(sql);
console.log(`Sentencias detectadas: ${stmts.length}`);

const base = `https://api.supabase.com/v1/projects/${REF}/database/query`;
let ok = 0;
const errors = [];
for (let n = 0; n < stmts.length; n++) {
  const stmt = stmts[n];
  const preview = stmt.replace(/\s+/g, ' ').slice(0, 70);
  try {
    const res = await fetch(base, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: stmt }),
    });
    const text = await res.text();
    if (res.ok) {
      ok++;
      console.log(`  ✔ [${n + 1}/${stmts.length}] ${preview}`);
    } else {
      errors.push({ n: n + 1, stmt, status: res.status, body: text });
      console.error(`  ✘ [${n + 1}/${stmts.length}] ${preview} -> HTTP ${res.status} ${text.slice(0, 300)}`);
    }
  } catch (e) {
    errors.push({ n: n + 1, stmt, status: 'fetch-error', body: String(e) });
    console.error(`  ✘ [${n + 1}/${stmts.length}] ${preview} -> ${e}`);
  }
}

console.log(`\nOK: ${ok}/${stmts.length}`);
if (errors.length) {
  console.log('\n=== ERRORES ===');
  for (const e of errors) {
    console.log(`\n--- Sentencia ${e.n} (HTTP ${e.status}) ---`);
    console.log(e.body.slice(0, 500));
  }
  process.exit(2);
}
