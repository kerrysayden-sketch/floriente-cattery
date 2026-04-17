import en from './en.json';
import uk from './uk.json';
import ru from './ru.json';
// PL and DE translations are machine-translated and await Native QA (Sprint 13).
// Their JSON, content files, and slug entries remain on disk for later re-enablement —
// search for "PL/DE soft rollback" to find the places to revert.
// import pl from './pl.json';
// import de from './de.json';
import { slugMap, type PageId } from './slugs';

export const languages = {
  en: 'English',
  uk: 'Українська',
  ru: 'Русский',
} as const;

export type Lang = keyof typeof languages;

export const defaultLang: Lang = 'en';

export const locales: Lang[] = ['en', 'uk', 'ru'];

// Languages visible in the switcher. Equal to `locales` now that PL/DE are soft-disabled.
// After Native QA (Sprint 13), re-add 'pl' and 'de' here and in `locales` above.
export const visibleLocales: Lang[] = ['en', 'uk', 'ru'];

// Machine-translated locales awaiting Native QA — currently empty because
// such locales are fully disabled at the routing layer (not rendered at all).
// If a future locale needs "visible but noindex" posture, add it here.
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

const translations = { en, uk, ru } as const;

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
