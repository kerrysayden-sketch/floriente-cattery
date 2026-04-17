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
        locales: { en: 'en', uk: 'uk', pl: 'pl', de: 'de', ru: 'ru' },
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
