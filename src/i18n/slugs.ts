import type { Lang } from './utils';

export type PageId = keyof typeof slugMap;

// PL and DE slug columns are kept here for fast restore after Native QA (Sprint 13).
// They are currently unused because pl/de are not in `locales` — but leaving them
// means rollback is one-line revert instead of re-deriving slugs.
export const slugMap = {
  home:         { en: '',            uk: '',            pl: '',            de: '',              ru: '' },
  about:        { en: 'about',       uk: 'pro-nas',     pl: 'o-nas',       de: 'ueber-uns',     ru: 'o-nas' },
  'our-cats':   { en: 'our-cats',    uk: 'nashi-koty',  pl: 'nasze-koty',  de: 'unsere-katzen', ru: 'nashi-koshki' },
  kittens:      { en: 'kittens',     uk: 'koshenyata',  pl: 'kocieta',     de: 'kitten',        ru: 'kotyata' },
  'how-to-buy': { en: 'how-to-buy',  uk: 'yak-prydbanty', pl: 'jak-kupic', de: 'kitten-kaufen', ru: 'kak-kupit' },
  contact:      { en: 'contact',     uk: 'kontakty',    pl: 'kontakt',     de: 'kontakt',       ru: 'kontakty' },
  faq:          { en: 'faq',         uk: 'faq',         pl: 'faq',         de: 'faq',           ru: 'faq' },
  blog:         { en: 'blog',        uk: 'blog',        pl: 'blog',        de: 'blog',          ru: 'blog' },
  legal:        { en: 'legal',       uk: 'legal',       pl: 'regulamin',   de: 'impressum',     ru: 'pravila' },
} as const;

const reverseMap = new Map<string, PageId>();
for (const [pageId, langs] of Object.entries(slugMap)) {
  for (const [lang, slug] of Object.entries(langs)) {
    reverseMap.set(`${lang}:${slug}`, pageId as PageId);
  }
}

export function getSlug(pageId: PageId, lang: Lang): string {
  return slugMap[pageId]?.[lang] ?? pageId;
}

export function getPageId(slug: string, lang: Lang): PageId | undefined {
  return reverseMap.get(`${lang}:${slug}`);
}

export function getLocalizedPagePath(pageId: PageId, lang: Lang): string {
  const slug = getSlug(pageId, lang);
  return slug ? `/${lang}/${slug}/` : `/${lang}/`;
}
