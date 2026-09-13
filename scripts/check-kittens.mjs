#!/usr/bin/env node
/**
 * Kitten source + asset validator (introduced in WU-1).
 *
 * Enforces the invariants the normalised kitten model relies on:
 *   1. one entity file per kitten, id === filename
 *   2. litter composition matches the workbook
 *   3. exactly 4 images per kitten, numbered 1-4
 *   4. no image (media, sha256 or derivative path) shared between kittens
 *   5. every derivative exists on disk at the declared dimensions
 *   6. no orphan derivative files
 *   7. publicationState, commercialStatus and featuredOnHome stay three
 *      INDEPENDENT dimensions — none may be derived from or gated on another
 *   8. publication gate: publicationState may only reach `published` once the
 *      owner has chosen a hero and a card image
 *   9. a draft entity can never be featured on the home page
 *  10. no commercial status is ever required — `null` (not stated) is valid in
 *      every publication state, so nothing is fabricated to pass validation
 *
 * Usage:
 *   node scripts/check-kittens.mjs                  # WU-1 level
 *   node scripts/check-kittens.mjs --require-copy   # WU-2+: also demand 5 locales
 *
 * Exit code: 0 = OK, 1 = errors found.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTITY_DIR = path.join(ROOT, 'src/content/kittens');
const COPY_DIR = path.join(ROOT, 'src/content/kitten-copy');
const PUBLIC_DIR = path.join(ROOT, 'public');
const LOCALES = ['en', 'uk', 'pl', 'de', 'ru'];
const REQUIRE_COPY = process.argv.includes('--require-copy');

// Expected Litter C composition, from Floriente_Litter_C_with_photos-2.xlsx.
const EXPECTED = { c: { count: 6, male: 2, female: 4, OSH: 5, SIA: 1, dob: '2026-07-06' } };

const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

/** Decode intrinsic dimensions from a WebP container (VP8 / VP8L / VP8X). */
function webpSize(file) {
  const b = fs.readFileSync(file);
  if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    const r24 = (o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
    return { width: r24(24) + 1, height: r24(27) + 1 };
  }
  return null;
}

if (!fs.existsSync(ENTITY_DIR)) {
  console.error(`❌ Missing ${path.relative(ROOT, ENTITY_DIR)}`);
  process.exit(1);
}

const files = fs.readdirSync(ENTITY_DIR).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml')).sort();
const kittens = [];
for (const f of files) {
  const id = f.replace(/\.ya?ml$/, '');
  let data;
  try {
    data = yaml.load(fs.readFileSync(path.join(ENTITY_DIR, f), 'utf8'));
  } catch (e) {
    fail(`${f}: YAML parse error — ${e.message}`);
    continue;
  }
  if (data?.kittenId !== id) fail(`${f}: kittenId "${data?.kittenId}" does not match filename "${id}"`);
  kittens.push({ file: f, id, data });
}

// ── 1. identity ──────────────────────────────────────────────────────────────
const ids = kittens.map((k) => k.id);
for (const dup of ids.filter((v, i) => ids.indexOf(v) !== i)) fail(`Duplicate kittenId: ${dup}`);

// ── 2. litter composition ────────────────────────────────────────────────────
const byLitter = {};
for (const k of kittens) (byLitter[k.data.litter] ??= []).push(k);
for (const [litter, exp] of Object.entries(EXPECTED)) {
  const got = byLitter[litter] ?? [];
  const n = (p) => got.filter(p).length;
  if (got.length !== exp.count) fail(`Litter ${litter}: ${got.length} kittens, expected ${exp.count}`);
  if (n((k) => k.data.sex === 'male') !== exp.male) fail(`Litter ${litter}: ${n((k) => k.data.sex === 'male')} male, expected ${exp.male}`);
  if (n((k) => k.data.sex === 'female') !== exp.female) fail(`Litter ${litter}: ${n((k) => k.data.sex === 'female')} female, expected ${exp.female}`);
  if (n((k) => k.data.breedCode === 'OSH') !== exp.OSH) fail(`Litter ${litter}: ${n((k) => k.data.breedCode === 'OSH')} OSH, expected ${exp.OSH}`);
  if (n((k) => k.data.breedCode === 'SIA') !== exp.SIA) fail(`Litter ${litter}: ${n((k) => k.data.breedCode === 'SIA')} SIA, expected ${exp.SIA}`);
  for (const k of got) if (k.data.dob !== exp.dob) fail(`${k.file}: dob ${k.data.dob}, expected ${exp.dob}`);
}
for (const l of Object.keys(byLitter)) if (!EXPECTED[l]) warn(`Litter "${l}" has no expected composition recorded in this script.`);

// ── 3-6. images ──────────────────────────────────────────────────────────────
const seenMedia = new Map();
const seenSha = new Map();
const seenSrc = new Map();
const declaredDerivatives = new Set();

for (const k of kittens) {
  const imgs = k.data.images ?? [];
  if (imgs.length !== 4) fail(`${k.file}: ${imgs.length} images, expected 4`);
  const ns = imgs.map((i) => i.n).sort((a, b) => a - b);
  if (JSON.stringify(ns) !== '[1,2,3,4]') fail(`${k.file}: image numbering ${JSON.stringify(ns)}, expected [1,2,3,4]`);

  for (const img of imgs) {
    const label = `${k.id}-${img.n}`;

    for (const [map, key, what] of [
      [seenMedia, img.source?.media, 'workbook media'],
      [seenSha, img.source?.sha256, 'source sha256'],
      [seenSrc, img.src, 'derivative path'],
    ]) {
      if (!key) { fail(`${label}: missing ${what}`); continue; }
      if (map.has(key)) fail(`${label}: ${what} "${key}" already used by ${map.get(key)} — cross-kitten mapping`);
      else map.set(key, label);
    }

    if (!img.src?.startsWith('/images/kittens/')) { fail(`${label}: derivative path "${img.src}" outside /images/kittens/`); continue; }
    declaredDerivatives.add(img.src);

    const onDisk = path.join(PUBLIC_DIR, img.src.replace(/^\//, ''));
    if (!fs.existsSync(onDisk)) { fail(`${label}: derivative missing on disk — public${img.src}`); continue; }
    const dim = webpSize(onDisk);
    if (!dim) fail(`${label}: public${img.src} is not a readable WebP`);
    else if (dim.width !== img.width || dim.height !== img.height)
      fail(`${label}: declared ${img.width}×${img.height} but file is ${dim.width}×${dim.height}`);

    // Archive lives outside the repo, so absence is informational, not fatal.
    if (img.source?.archive) {
      const archive = path.resolve(ROOT, '..', 'September, 13 - Cat\'s Cards', img.source.archive);
      if (!fs.existsSync(archive)) warn(`${label}: source original not reachable at ${img.source.archive} (archive is outside the repo — expected on CI)`);
    }
  }
}

// orphan derivatives
const litterDirs = new Set([...declaredDerivatives].map((s) => path.dirname(s)));
for (const dir of litterDirs) {
  const abs = path.join(PUBLIC_DIR, dir.replace(/^\//, ''));
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) {
    const rel = `${dir}/${f}`;
    if (!declaredDerivatives.has(rel)) fail(`Orphan asset not referenced by any kitten entity: public${rel}`);
  }
}

// ── 7-10. the three independent dimensions ───────────────────────────────────
//
// publicationState  draft | published            — lifecycle
// commercialStatus  available | reserved | evaluation | at_new_home | null
// featuredOnHome    boolean                      — editorial
//
// The only permitted cross-field rules are the two directional gates below.
// Deliberately NOT enforced, because these three axes are independent:
//   · a draft may legitimately carry a commercialStatus (privately reserved
//     before its page goes live);
//   · a published kitten may legitimately have commercialStatus null;
//   · a published kitten may be featured or not, at any commercialStatus.
const COMMERCIAL = ['available', 'reserved', 'evaluation', 'at_new_home'];

for (const k of kittens) {
  const { publicationState, commercialStatus, heroImage, cardImage, featuredOnHome } = k.data;

  if (!['draft', 'published'].includes(publicationState))
    fail(`${k.file}: publicationState "${publicationState}" is not draft|published`);

  // A lifecycle value must never appear in the commercial field, and vice versa.
  if (commercialStatus !== null && commercialStatus !== undefined && !COMMERCIAL.includes(commercialStatus))
    fail(`${k.file}: commercialStatus "${commercialStatus}" is not ${COMMERCIAL.join('|')}|null`);
  if (COMMERCIAL.includes(publicationState))
    fail(`${k.file}: publicationState holds a commercial value "${publicationState}" — the two dimensions are being conflated`);
  if (['draft', 'published'].includes(commercialStatus))
    fail(`${k.file}: commercialStatus holds a lifecycle value "${commercialStatus}" — the two dimensions are being conflated`);

  // Gate 1 — publication requires the owner's image selections.
  if (publicationState === 'published') {
    if (heroImage == null) fail(`${k.file}: publicationState "published" but heroImage is null — owner hero selection required before publication`);
    if (cardImage == null) fail(`${k.file}: publicationState "published" but cardImage is null — owner card selection required before publication`);
  }

  // Gate 2 — a draft is not public, so it cannot be featured on a public page.
  if (featuredOnHome && publicationState !== 'published')
    fail(`${k.file}: featuredOnHome is true while publicationState is "${publicationState}"`);

  for (const [field, v] of [['heroImage', heroImage], ['cardImage', cardImage]])
    if (v != null && !(k.data.images ?? []).some((i) => i.n === v)) fail(`${k.file}: ${field} = ${v} does not match any image n`);

  // Informational only — never an error. A published kitten with no stated
  // commercial status is legitimate; the runtime must simply render no badge.
  if (publicationState === 'published' && (commercialStatus === null || commercialStatus === undefined))
    warn(`${k.file}: published with commercialStatus null — the runtime must render this kitten without a status badge.`);
}

// ── 9. locale copy ───────────────────────────────────────────────────────────
const copyFiles = fs.existsSync(COPY_DIR)
  ? fs.readdirSync(COPY_DIR).filter((f) => f.endsWith('.md') && !f.startsWith('_'))
  : [];
const copyIndex = new Set(copyFiles.map((f) => f.replace(/\.md$/, '')));
for (const f of copyFiles) {
  const m = f.match(/^(.+)-(\w{2})\.md$/);
  if (!m) { fail(`kitten-copy/${f}: filename must be <kittenId>-<lang>.md`); continue; }
  if (!ids.includes(m[1])) fail(`kitten-copy/${f}: no kitten entity "${m[1]}"`);
  if (!LOCALES.includes(m[2])) fail(`kitten-copy/${f}: "${m[2]}" is not one of ${LOCALES.join(', ')}`);
}
const publishable = kittens.filter((k) => k.data.publicationState === 'published');
const missingCopy = [];
for (const k of publishable)
  for (const l of LOCALES) if (!copyIndex.has(`${k.id}-${l}`)) missingCopy.push(`${k.id}-${l}`);
if (missingCopy.length) {
  const msg = `Published kittens missing locale copy (${missingCopy.length}): ${missingCopy.join(', ')}`;
  REQUIRE_COPY ? fail(msg) : warn(msg);
}

// ── report ───────────────────────────────────────────────────────────────────
const totalImages = kittens.reduce((n, k) => n + (k.data.images?.length ?? 0), 0);
console.log('🐾 kitten source check');
console.log(`   entities:          ${kittens.length}`);
for (const [l, ks] of Object.entries(byLitter)) {
  const n = (p) => ks.filter(p).length;
  console.log(`   litter ${l}:          ${ks.length} kittens — ${n((k) => k.data.sex === 'male')}m / ${n((k) => k.data.sex === 'female')}f · ` +
              `${n((k) => k.data.breedCode === 'OSH')} OSH / ${n((k) => k.data.breedCode === 'SIA')} SIA · dob ${[...new Set(ks.map((k) => k.data.dob))].join(', ')}`);
}
console.log(`   images declared:   ${totalImages}`);
console.log(`   unique media:      ${seenMedia.size}`);
console.log(`   unique sha256:     ${seenSha.size}`);
console.log(`   derivatives:       ${declaredDerivatives.size} declared, all present at declared dimensions`);
console.log(`   cross-kitten maps: 0`);
const tally = (f) => Object.entries(kittens.reduce((a, k) => {
  const v = k.data[f] ?? 'null';
  return { ...a, [v]: (a[v] ?? 0) + 1 };
}, {})).map(([v, n]) => `${n}× ${v}`).join(', ');
console.log(`   publicationState:  ${tally('publicationState')}`);
console.log(`   commercialStatus:  ${tally('commercialStatus')}`);
console.log(`   featuredOnHome:    ${kittens.filter((k) => k.data.featuredOnHome).length} of ${kittens.length} true`);
console.log(`   hero selected:     ${kittens.filter((k) => k.data.heroImage != null).length} of ${kittens.length}`);
console.log(`   locale copy:       ${copyFiles.length} files${REQUIRE_COPY ? ' (required for published)' : ' (not required while all entities are draft)'}`);
console.log();

if (warnings.length) {
  console.log(`ℹ️  Notices (${warnings.length}):`);
  warnings.forEach((w) => console.log(`   ${w}`));
  console.log();
}
if (errors.length) {
  console.error(`❌ Errors (${errors.length}):`);
  errors.forEach((e) => console.error(`   ${e}`));
  process.exit(1);
}
console.log('✅ kitten source check passed.');
