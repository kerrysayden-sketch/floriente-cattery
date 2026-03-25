// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { storyblok } from '@storyblok/astro';

// https://astro.build/config
export default defineConfig({
  site: 'https://florientecattery.com',
  integrations: [
    storyblok({
      accessToken: import.meta.env.STORYBLOK_TOKEN,
      components: {
        page: 'storyblok/Page',
        hero: 'storyblok/Hero',
        richtext: 'storyblok/RichText',
      },
      apiOptions: {
        region: 'eu',
      },
    }),
  ],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'uk'],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: true,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
