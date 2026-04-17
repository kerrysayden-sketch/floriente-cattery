// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { storyblok } from '@storyblok/astro';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://florientecattery.com',
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'en',
        // PL/DE disabled at routing layer (Sprint 12.1 — soft rollback). No filter needed.
        locales: { en: 'en', uk: 'uk', ru: 'ru' },
      },
    }),
    storyblok({
      accessToken: import.meta.env.STORYBLOK_TOKEN,
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
    // PL/DE soft-rolled-back (Sprint 12.1). See src/i18n/utils.ts for restore notes.
    locales: ['en', 'uk', 'ru'],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: true,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
