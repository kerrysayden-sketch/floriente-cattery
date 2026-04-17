// Build script: download WOFF2 files from Google Fonts CSS and rewrite paths to local.
//
// Usage (from project root):
//   1. Fetch latest CSS: curl -A "Mozilla/..." "https://fonts.googleapis.com/css2?family=..." -o public/fonts/fonts.css
//   2. Run: node scripts/build-fonts.mjs
//
// Keeps subsets: latin, latin-ext, cyrillic, cyrillic-ext
// (Our 5 langs — EN, UK, PL, DE, RU — are covered by these four subsets. Vietnamese skipped.)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(__dirname, "..", "public", "fonts", "fonts.css"), 'utf8');

const KEEP_SUBSETS = new Set(['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext']);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36';

// Parse into blocks. Each block = comment (subset label) + @font-face {...}
const blockRegex = /\/\*\s*([a-z\-]+)\s*\*\/\s*@font-face\s*\{([\s\S]+?)\}/g;

const filesDir = path.join(__dirname, '..', 'public', 'fonts', 'files');
fs.mkdirSync(filesDir, { recursive: true });

let out = '/* Self-hosted Google Fonts — Cormorant Garamond + Inter */\n';
let keptBlocks = 0;
let downloaded = 0;
const downloadedSet = new Map(); // url -> Buffer

const matches = [...css.matchAll(blockRegex)];
console.log(`Parsed ${matches.length} @font-face blocks`);

for (const [, subset, body] of matches) {
  if (!KEEP_SUBSETS.has(subset)) continue;

  const urlMatch = body.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
  if (!urlMatch) continue;
  const url = urlMatch[1];
  const family = body.match(/font-family:\s*'([^']+)'/)?.[1]?.replace(/\s+/g, '-').toLowerCase() ?? 'unknown';
  const weight = body.match(/font-weight:\s*(\d+)/)?.[1] ?? '400';
  const style = body.match(/font-style:\s*(\w+)/)?.[1] ?? 'normal';
  const filename = `${family}-${weight}${style === 'italic' ? 'i' : ''}-${subset}.woff2`;
  const filePath = path.join(filesDir, filename);

  // Download if file missing. Multiple weights may share the same Google URL —
  // in that case we fetch once and write the buffer under every needed filename.
  if (!fs.existsSync(filePath)) {
    if (!downloadedSet.has(url)) {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) {
        console.error(`FAIL ${url} (${res.status})`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      downloadedSet.set(url, buf);
      downloaded++;
    }
    const buf = downloadedSet.get(url);
    fs.writeFileSync(filePath, buf);
    console.log(`→ ${filename} (${buf.length} bytes)`);
  }

  const localBody = body.replace(/url\(https:\/\/[^)]+\)/, `url(/fonts/files/${filename})`);
  out += `/* ${subset} */\n@font-face {${localBody}}\n\n`;
  keptBlocks++;
}

if (keptBlocks === 0) {
  console.error('\n⚠ No gstatic.com URLs in input — fonts.css appears already-rewritten.');
  console.error('  Re-fetch the raw CSS from Google first (see usage note at top). Skipping write.');
  process.exit(1);
}

fs.writeFileSync(path.join(__dirname, "..", "public", "fonts", "fonts.css"), out);
console.log(`\nDone. Kept ${keptBlocks} blocks, downloaded ${downloaded} new files.`);
