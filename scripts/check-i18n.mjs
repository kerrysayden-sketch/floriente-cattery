#!/usr/bin/env node
/**
 * i18n validator for Floriente Cattery
 *
 * Checks:
 *   1. en.json and uk.json have identical key sets (no key drift)
 *   2. All keys used via t(lang, '...') in source are defined
 *   3. Reports unused keys (informational, doesn't fail)
 *
 * Usage: npm run i18n:check
 * Exit code: 0 = OK, 1 = errors found
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

function flatten(obj, prefix = '') {
  const keys = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, full).forEach((kk) => keys.add(kk));
    } else {
      keys.add(full);
    }
  }
  return keys;
}

function walk(dir, exts, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, files);
    else if (exts.some((e) => entry.name.endsWith(e))) files.push(full);
  }
  return files;
}

const en = JSON.parse(fs.readFileSync(path.join(SRC, 'i18n/en.json'), 'utf8'));
const uk = JSON.parse(fs.readFileSync(path.join(SRC, 'i18n/uk.json'), 'utf8'));
const enKeys = flatten(en);
const ukKeys = flatten(uk);

const errors = [];

// 1. Sync check
const onlyInEn = [...enKeys].filter((k) => !ukKeys.has(k));
const onlyInUk = [...ukKeys].filter((k) => !enKeys.has(k));
if (onlyInEn.length) errors.push(`Keys only in en.json (${onlyInEn.length}):\n  ${onlyInEn.join('\n  ')}`);
if (onlyInUk.length) errors.push(`Keys only in uk.json (${onlyInUk.length}):\n  ${onlyInUk.join('\n  ')}`);

// 2. Used keys check
const sourceFiles = walk(SRC, ['.astro', '.ts', '.js', '.mjs']);
const allSource = sourceFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const usedKeys = new Set();
const KEY_RE = /t\(\s*lang\s*,\s*['"`]([a-zA-Z_][\w.]*)['"`]/g;
let m;
while ((m = KEY_RE.exec(allSource)) !== null) usedKeys.add(m[1]);

// Dynamic key heuristic: capture template literal patterns like `prefix.${var}Suffix`
const DYN_RE = /t\(\s*lang\s*,\s*`([a-zA-Z_][\w.]*)\.\$\{[^}]+\}([a-zA-Z_]*)`/g;
const dynamicPrefixes = new Set();
while ((m = DYN_RE.exec(allSource)) !== null) {
  dynamicPrefixes.add(`${m[1]}.`);
}

const missingKeys = [...usedKeys].filter((k) => !enKeys.has(k));
if (missingKeys.length)
  errors.push(`Used in code but not defined in en.json (${missingKeys.length}):\n  ${missingKeys.join('\n  ')}`);

// 3. Unused (info only)
const unusedKeys = [...enKeys].filter((k) => {
  if (usedKeys.has(k)) return false;
  // Skip keys under dynamic prefixes
  for (const prefix of dynamicPrefixes) if (k.startsWith(prefix)) return false;
  // Skip pages.* (page metadata, accessed via dynamic page name)
  if (k.startsWith('pages.')) return false;
  return true;
});

console.log(`📊 i18n stats:`);
console.log(`   en.json keys:     ${enKeys.size}`);
console.log(`   uk.json keys:     ${ukKeys.size}`);
console.log(`   used in source:   ${usedKeys.size}`);
console.log(`   dynamic prefixes: ${[...dynamicPrefixes].join(', ') || 'none'}`);
console.log();

if (unusedKeys.length) {
  console.log(`ℹ️  Possibly unused keys (${unusedKeys.length}):`);
  unusedKeys.forEach((k) => console.log(`   ${k}`));
  console.log();
}

if (errors.length) {
  console.error('❌ Errors:');
  errors.forEach((e) => console.error(e));
  process.exit(1);
}

console.log('✅ i18n check passed.');
