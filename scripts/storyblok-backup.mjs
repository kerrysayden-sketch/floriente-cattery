#!/usr/bin/env node
// Storyblok content backup — manual export for BK-02.
// Reads STORYBLOK_TOKEN from env (loaded by scripts/load-env.sh).
// Writes JSON to ../backups/storyblok-export-YYYY-MM-DD.json (outside git repo,
// inside project folder on owner's MacBook = off-site from Storyblok per BK-02).

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN = process.env.STORYBLOK_TOKEN;
if (!TOKEN) {
  console.error('STORYBLOK_TOKEN not set. Source scripts/load-env.sh first, or run via `npm run backup:storyblok`.');
  process.exit(1);
}

const CDN = 'https://api.storyblok.com/v2/cdn';
const VERSION = 'draft'; // captures unpublished + published content

async function fetchJson(path, params = {}) {
  const url = new URL(`${CDN}/${path}`);
  url.searchParams.set('token', TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${path}: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchAllStories() {
  const stories = [];
  let page = 1;
  while (true) {
    const data = await fetchJson('stories', {
      version: VERSION,
      per_page: '100',
      page: String(page),
    });
    const batch = data.stories || [];
    stories.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return stories;
}

async function fetchDatasources() {
  try {
    const list = await fetchJson('datasources');
    const result = [];
    for (const ds of list.datasources || []) {
      const entries = await fetchJson('datasource_entries', {
        datasource: ds.slug,
        per_page: '1000',
      });
      result.push({
        slug: ds.slug,
        name: ds.name,
        entries: entries.datasource_entries || [],
      });
    }
    return result;
  } catch (err) {
    console.warn(`  Datasource fetch failed (non-fatal): ${err.message}`);
    return [];
  }
}

async function main() {
  console.log('Storyblok backup starting...');

  const stories = await fetchAllStories();
  console.log(`  Stories: ${stories.length}`);

  const datasources = await fetchDatasources();
  console.log(`  Datasources: ${datasources.length}`);

  const exportedAt = new Date().toISOString();
  const dateStr = exportedAt.slice(0, 10);

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(__dirname, '../../backups');
  const outFile = resolve(outDir, `storyblok-export-${dateStr}.json`);

  await mkdir(outDir, { recursive: true });

  const payload = {
    exported_at: exportedAt,
    version: VERSION,
    source: 'Storyblok Content Delivery API (Preview token)',
    counts: {
      stories: stories.length,
      datasources: datasources.length,
    },
    stories,
    datasources,
  };

  const json = JSON.stringify(payload, null, 2);
  await writeFile(outFile, json);

  const sizeKb = (json.length / 1024).toFixed(1);
  console.log(`\nBackup saved: ${outFile}`);
  console.log(`  Size: ${sizeKb} KB`);
  console.log(`  Exported at: ${exportedAt}`);
}

main().catch((err) => {
  console.error('\nBackup failed:', err.message);
  process.exit(1);
});
