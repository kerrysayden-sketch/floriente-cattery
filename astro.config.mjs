// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { storyblok } from '@storyblok/astro';
import sitemap from '@astrojs/sitemap';
import { readFileSync, readdirSync } from 'node:fs';
import { slugMap } from './src/i18n/slugs';

const storyblokToken = process.env.STORYBLOK_TOKEN;
if (!storyblokToken) {
  throw new Error('STORYBLOK_TOKEN not set. Source scripts/load-env.sh or set the env var.');
}

// Sitemap helpers: real publishDate per blog slug (lastmod) and correct
// hreflang alternates for localized page slugs (the built-in sitemap i18n
// option matches locales by identical paths, which our localized slugs break).
const SITE = 'https://florientecattery.com';
const SITEMAP_LOCALES = ['en', 'uk', 'pl', 'de', 'ru'];

// Localized parent segment for kitten routes, keyed by locale. Typed explicitly
// because this file is checked JS and `slugMap.kittens` is a const-asserted
// object that cannot be indexed by a plain string.
/** @type {Record<string, string>} */
const KITTENS_SLUG = slugMap.kittens;

const blogDates = {};
for (const f of readdirSync('./src/content/blog')) {
  const m = f.match(/^(.*)-en\.md$/);
  if (!m) continue;
  const d = readFileSync(`./src/content/blog/${f}`, 'utf8').match(/^publishDate:\s*"([0-9-]+)"/m);
  if (d) blogDates[m[1]] = d[1];
}

function sitemapSerialize(item) {
  const path = new URL(item.url).pathname;
  const m = path.match(/^\/(en|uk|pl|de|ru)\/(.*)$/);
  if (!m) return item;
  const rest = m[2];
  let links = null;
  if (rest === '') {
    links = SITEMAP_LOCALES.map((l) => ({ url: `${SITE}/${l}/`, lang: l }));
  } else if (rest.startsWith('blog/')) {
    // blog slugs are identical across locales
    links = SITEMAP_LOCALES.map((l) => ({ url: `${SITE}/${l}/${rest}`, lang: l }));
    const slug = rest.replace(/^blog\//, '').replace(/\/$/, '');
    if (slug && blogDates[slug]) item.lastmod = blogDates[slug];
  } else {
    const slug = rest.replace(/\/$/, '');
    const pageId = Object.keys(slugMap).find((k) => slugMap[k][m[1]] === slug);
    if (pageId) {
      links = SITEMAP_LOCALES.map((l) => ({ url: `${SITE}/${l}/${slugMap[pageId][l]}/`, lang: l }));
    } else {
      // Kitten detail pages: the parent segment is localized, the kittenId is
      // locale-invariant (the same shape as blog articles). Without this the
      // whole-path slugMap lookup above finds nothing and the entry ships with
      // no alternates, so on-page hreflang and the sitemap would disagree.
      const kittensPrefix = `${KITTENS_SLUG[m[1]]}/`;
      if (slug.startsWith(kittensPrefix)) {
        const kittenId = slug.slice(kittensPrefix.length);
        if (kittenId && !kittenId.includes('/')) {
          links = SITEMAP_LOCALES.map((l) => ({ url: `${SITE}/${l}/${KITTENS_SLUG[l]}/${kittenId}/`, lang: l }));
        }
      }
    }
  }
  if (links) {
    links.push({ url: links.find((x) => x.lang === 'en').url, lang: 'x-default' });
    item.links = links;
  }
  return item;
}

// https://astro.build/config
export default defineConfig({
  site: 'https://florientecattery.com',
  integrations: [
    sitemap({
      // root '/' is a 302 redirect to /en/, not a canonical page
      filter: (page) => page !== `${SITE}/`,
      serialize: sitemapSerialize,
    }),
    storyblok({
      accessToken: storyblokToken,
      components: {
        page: 'storyblok/Page',
        hero: 'storyblok/Hero',
        richtext: 'storyblok/RichText',
      },
      apiOptions: {
        region: '',
      },
    }),
  ],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'uk', 'pl', 'de', 'ru'],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: true,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
