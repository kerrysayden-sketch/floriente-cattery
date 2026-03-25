import en from './en.json';
import ru from './ru.json';

export const languages = {
  en: 'English',
  ru: 'Русский',
} as const;

export type Lang = keyof typeof languages;

export const defaultLang: Lang = 'en';

export const locales: Lang[] = ['en', 'ru'];

export function createLangStaticPaths() {
  return locales.map((lang) => ({
    params: { lang },
    props: { lang },
  }));
}

const translations = { en, ru } as const;

export function t(lang: Lang, key: string): string {
  const keys = key.split('.');
  let value: any = translations[lang];
  for (const k of keys) {
    value = value?.[k];
  }
  return value ?? key;
}

export function getLanguageFromURL(pathname: string): Lang {
  const match = pathname.match(/^\/(en|ru)\//);
  return (match?.[1] as Lang) ?? defaultLang;
}

export function getLocalizedPath(path: string, lang: Lang): string {
  const cleanPath = path.replace(/^\/(en|ru)/, '');
  return `/${lang}${cleanPath || '/'}`;
}
