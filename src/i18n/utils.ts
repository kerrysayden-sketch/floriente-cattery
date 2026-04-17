import en from './en.json';
import uk from './uk.json';
import pl from './pl.json';
import de from './de.json';
import ru from './ru.json';
// PL/DE re-enabled 2026-04-17 following "ship, iterate" strategy.
// Machine-translated content ships now; native QA polishes iteratively based on
// real user signals. No noindex — let Google index, traffic measure, improve later.
import { slugMap, type PageId } from './slugs';

export const languages = {
  en: 'English',
  uk: 'Українська',
  pl: 'Polski',
  de: 'Deutsch',
  ru: 'Русский',
} as const;

export type Lang = keyof typeof languages;

export const defaultLang: Lang = 'en';

export const locales: Lang[] = ['en', 'uk', 'pl', 'de', 'ru'];

// All 5 languages visible in the switcher.
export const visibleLocales: Lang[] = ['en', 'uk', 'pl', 'de', 'ru'];

// Locales with noindex meta (if a specific locale needs "visible but not indexed").
// Currently empty — all active locales are indexable.
export const noindexLocales: Lang[] = [];

export function isNoindexLocale(lang: Lang): boolean {
  return noindexLocales.includes(lang);
}

// Locales safe for indexing — used by sitemap filter + hreflang alternates.
export const indexableLocales: Lang[] = locales.filter((l) => !noindexLocales.includes(l));

export function createLangStaticPaths() {
  return locales.map((lang) => ({
    params: { lang },
    props: { lang },
  }));
}

const translations = { en, uk, pl, de, ru } as const;

export function t(lang: Lang, key: string): string {
  const keys = key.split('.');
  let value: any = translations[lang];
  for (const k of keys) {
    value = value?.[k];
  }
  return value ?? key;
}

const langPattern = locales.join('|');
const langRegex = new RegExp(`^\\/(${langPattern})\\/`);
const langStripRegex = new RegExp(`^\\/(${langPattern})`);

export function getLanguageFromURL(pathname: string): Lang {
  const match = pathname.match(langRegex);
  return (match?.[1] as Lang) ?? defaultLang;
}

export function getLocalizedPath(path: string, lang: Lang): string {
  const cleanPath = path.replace(langStripRegex, '').replace(/^\/+/, '').replace(/\/+$/, '');

  if (!cleanPath) return `/${lang}/`;

  const segments = cleanPath.split('/');
  const firstSegment = segments[0];

  // Find pageId by checking if firstSegment matches slug in ANY language
  for (const [, langs] of Object.entries(slugMap)) {
    for (const sourceLang of locales) {
      const sourceSlug = langs[sourceLang as keyof typeof langs];
      if (sourceSlug === firstSegment) {
        const targetSlug = langs[lang as keyof typeof langs];
        const rest = segments.slice(1).join('/');
        const suffix = rest ? `/${rest}/` : '/';
        return targetSlug ? `/${lang}/${targetSlug}${suffix}` : `/${lang}${suffix}`;
      }
    }
  }

  return `/${lang}/${cleanPath}/`;
}
