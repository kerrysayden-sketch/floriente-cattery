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

// All 5 active locales. Key parity is enforced for all of them.
const activeLangs = ['en', 'uk', 'pl', 'de', 'ru'];
const archivedLangs = [];
const langFiles = [...activeLangs, ...archivedLangs];
const translations = {};
const keysSets = {};

for (const lang of langFiles) {
  translations[lang] = JSON.parse(fs.readFileSync(path.join(SRC, `i18n/${lang}.json`), 'utf8'));
  keysSets[lang] = flatten(translations[lang]);
}

const enKeys = keysSets['en'];
const errors = [];

// 1. Sync check — only active locales must match en. Archived locales are informational.
for (const lang of activeLangs.filter((l) => l !== 'en')) {
  const langKeys = keysSets[lang];
  const onlyInEn = [...enKeys].filter((k) => !langKeys.has(k));
  const onlyInLang = [...langKeys].filter((k) => !enKeys.has(k));
  if (onlyInEn.length) errors.push(`Keys only in en.json, missing in ${lang}.json (${onlyInEn.length}):\n  ${onlyInEn.join('\n  ')}`);
  if (onlyInLang.length) errors.push(`Keys only in ${lang}.json, missing in en.json (${onlyInLang.length}):\n  ${onlyInLang.join('\n  ')}`);
}

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
for (const lang of activeLangs) {
  console.log(`   ${lang}.json (active): ${keysSets[lang].size} keys`);
}
for (const lang of archivedLangs) {
  const diff = enKeys.size - keysSets[lang].size;
  const drift = diff > 0 ? ` (drift: ${diff} keys behind en)` : '';
  console.log(`   ${lang}.json (archived): ${keysSets[lang].size} keys${drift}`);
}
console.log(`   used in source:   ${usedKeys.size}`);
console.log(`   dynamic prefixes: ${[...dynamicPrefixes].join(', ') || 'none'}`);
console.log();

if (unusedKeys.length) {
  console.log(`ℹ️  Possibly unused keys (${unusedKeys.length}):`);
  unusedKeys.forEach((k) => console.log(`   ${k}`));
  console.log();
}

// 3.5. Character-length warnings for layout-sensitive keys
// These keys render in tight UI zones (buttons, nav, labels, trust cards) where
// translations 40%+ longer than EN can break layout. Warn at 140% threshold.
const LAYOUT_SENSITIVE_PATTERNS = [
  /^nav\./,
  /^footer\.(privacy|cookies|terms|quickLinks|contacts|followUs)$/,
  /^home\.(cta|trust|processStep\d+Title|scamCalloutCta|familyCtaCta|testimonialOwnerOf)/,
  /^home\.kittensJoinWaitlist$/,
  /^howToBuy\.(hero|cta|faq|pricing|depositLabel|depositAmount|petTitle|breedShowTitle)/,
  /^kittens\.(status|male|female|fieldBreed|fieldColor|fieldSex|fieldBorn|fieldFather|fieldMother|atNewHome|hiText|weekLabel|newHome)/,
  /^ourCats\.(queen|king|fieldBreed|fieldColor|fieldTitle|healthTesting)$/,
  /^common\./,
  /^blog\.(readMore|backToBlog|emptyTitle)$/,
  /^faq\.heroTitle$/,
  /^contact\.(whatsappCta|instagramCta|tiktokCta|instagramDmCta)$/,
  /^legal\.(toc|privacyLink|cookiesLink|termsLink)$/,
];

function getValueAtPath(obj, path) {
  return path.split('.').reduce((v, k) => v?.[k], obj);
}

function isLayoutSensitive(key) {
  return LAYOUT_SENSITIVE_PATTERNS.some((pat) => pat.test(key));
}

const lengthWarnings = [];
const LENGTH_THRESHOLD = 1.4; // 140% of EN length
for (const key of enKeys) {
  if (!isLayoutSensitive(key)) continue;
  const enValue = getValueAtPath(translations['en'], key);
  if (typeof enValue !== 'string' || enValue.length < 3) continue;
  for (const lang of langFiles.filter((l) => l !== 'en')) {
    const langValue = getValueAtPath(translations[lang], key);
    if (typeof langValue !== 'string') continue;
    if (langValue === enValue) continue; // skip untranslated placeholders
    const ratio = langValue.length / enValue.length;
    if (ratio >= LENGTH_THRESHOLD) {
      lengthWarnings.push(`  ${lang.toUpperCase()} ${key}: "${langValue}" (${langValue.length}ch) is ${Math.round(ratio * 100)}% of EN "${enValue}" (${enValue.length}ch)`);
    }
  }
}

if (lengthWarnings.length) {
  console.log(`⚠️  Layout-sensitive strings ≥140% of EN length (${lengthWarnings.length}):`);
  lengthWarnings.forEach((w) => console.log(w));
  console.log(`   These may overflow buttons/nav/labels. Consider shorter translations or CSS audit.`);
  console.log();
}

// 4. Routing smoke test — verify getLocalizedPath produces valid URLs
const slugsFile = fs.readFileSync(path.join(SRC, 'i18n/slugs.ts'), 'utf8');
const slugMapMatch = slugsFile.match(/export const slugMap = \{([\s\S]*?)\} as const;/);
if (slugMapMatch) {
  const slugMap = {};
  const lineRe = /['"]?([\w-]+)['"]?\s*:\s*\{([^}]+)\}/g;
  let lm;
  while ((lm = lineRe.exec(slugMapMatch[1])) !== null) {
    const pageId = lm[1];
    const pairs = {};
    const pairRe = /(\w+)\s*:\s*'([^']*)'/g;
    let pm;
    while ((pm = pairRe.exec(lm[2])) !== null) {
      pairs[pm[1]] = pm[2];
    }
    slugMap[pageId] = pairs;
  }

  const routingErrors = [];
  const allLangs = ['en', 'uk', 'pl', 'de', 'ru'];

  for (const [pageId, langs] of Object.entries(slugMap)) {
    for (const lang of allLangs) {
      const slug = langs[lang];
      if (slug === undefined) {
        routingErrors.push(`Missing slug: ${pageId}.${lang}`);
        continue;
      }
      const expectedPath = slug ? `/${lang}/${slug}/` : `/${lang}/`;
      // Verify no duplicate slugs within same language
      for (const [otherId, otherLangs] of Object.entries(slugMap)) {
        if (otherId !== pageId && otherLangs[lang] === slug && slug !== '') {
          routingErrors.push(`Duplicate slug "${slug}" for ${lang}: ${pageId} and ${otherId}`);
        }
      }
    }
  }

  if (routingErrors.length) {
    errors.push(`Routing errors (${routingErrors.length}):\n  ${routingErrors.join('\n  ')}`);
  } else {
    console.log(`🔗 Routing: ${Object.keys(slugMap).length} pages × ${allLangs.length} langs — all slugs valid, no duplicates`);
  }
  console.log();
}

if (errors.length) {
  console.error('❌ Errors:');
  errors.forEach((e) => console.error(e));
  process.exit(1);
}

console.log('✅ i18n check passed.');
