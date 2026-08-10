import type { Lang } from '../i18n/utils';

/** Official Floriente WhatsApp number (same as LocalBusiness contactPoint). */
export const WHATSAPP_NUMBER = '380931884422';

export type WhatsAppIntent = 'nextLitter' | 'generalContact' | 'howToBuy';

/**
 * Localized prefill messages per intent. Kept here (not in i18n JSON) because
 * they are URL payloads, not page-visible copy, and t() falls back to the raw
 * key string on a miss — which must never end up inside a wa.me link.
 */
const MESSAGES: Record<WhatsAppIntent, Record<Lang, string>> = {
  nextLitter: {
    en: 'Hello! I would like to ask about the kittens born on July 6, 2026, available after October 6, 2026, and join the waiting list.',
    ru: 'Здравствуйте! Хочу узнать о котятах, которые родились 6 июля 2026 и будут доступны после 6 октября 2026, и попасть в лист ожидания.',
    uk: 'Вітаю! Хочу дізнатися про кошенят, які народилися 6 липня 2026 і будуть доступні після 6 жовтня 2026, і потрапити до списку очікування.',
    de: 'Hallo! Ich möchte nach den Kätzchen fragen, die am 6. Juli 2026 geboren sind und nach dem 6. Oktober 2026 verfügbar sind, und mich auf die Warteliste setzen lassen.',
    pl: 'Dzień dobry! Chciałbym zapytać o kocięta urodzone 6 lipca 2026, dostępne po 6 października 2026, i dołączyć do listy oczekujących.',
  },
  generalContact: {
    en: 'Hello! I found Floriente Cattery on your website and would like to ask a question.',
    ru: 'Здравствуйте! Пишу с сайта Floriente Cattery и хочу задать вопрос.',
    uk: 'Вітаю! Пишу з сайту Floriente Cattery і хочу поставити запитання.',
    de: 'Hallo! Ich schreibe über die Website von Floriente Cattery und möchte eine Frage stellen.',
    pl: 'Dzień dobry! Piszę ze strony Floriente Cattery i chcę zadać pytanie.',
  },
  howToBuy: {
    en: 'Hello! I have read the How to Buy page and would like to ask about buying a kitten from Floriente Cattery.',
    ru: 'Здравствуйте! Пишу со страницы «Как купить» — хочу узнать о покупке котёнка из Floriente Cattery.',
    uk: 'Вітаю! Пишу зі сторінки «Як придбати» — хочу дізнатися про купівлю кошеняти з Floriente Cattery.',
    de: 'Hallo! Ich schreibe von der Seite „Kitten kaufen“ und möchte mich über den Kauf eines Kätzchens von Floriente Cattery informieren.',
    pl: 'Dzień dobry! Piszę ze strony „Jak kupić” — chcę zapytać o kupno kociaka z Floriente Cattery.',
  },
};

/**
 * Build a wa.me link. Without an intent (or on any lookup miss) it returns the
 * plain official link, so a bad key can never break a CTA. Optional `context`
 * (e.g. a page slug) is appended in parentheses.
 */
export function whatsappLink(lang: Lang, intent?: WhatsAppIntent, context?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  const text = intent ? MESSAGES[intent]?.[lang] : undefined;
  if (!text) return base;
  const full = context ? `${text} (${context})` : text;
  return `${base}?text=${encodeURIComponent(full)}`;
}
