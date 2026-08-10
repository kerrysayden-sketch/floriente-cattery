// Localized auto-reply copy. Lives here (not in the Astro i18n bundle) because
// the Pages Function runtime is separate from the static build. Plain text +
// minimal HTML. Mirrors the on-page expectations (born July 6, 2026, ready after October 6, 2026,
// no guarantee, we will be in touch).
import type { Locale } from './types.ts';

export interface ReplyCopy {
  subject: string;
  // Paragraphs — joined with blank lines for text, <p> for HTML.
  paragraphs: string[];
  signature: string;
}

export const autoReply: Record<Locale, ReplyCopy> = {
  en: {
    subject: 'Floriente Cattery — you are on the waitlist',
    paragraphs: [
      'Thank you for joining the Floriente Cattery waitlist. We have received your details.',
      'The kittens were born on July 6, 2026 and will be ready for their new homes after October 6, 2026, at 3 months of age.',
      'Joining the waitlist does not guarantee a reservation. We will be in touch with you.',
    ],
    signature: 'Warm regards,\nElvira — Floriente Cattery',
  },
  uk: {
    subject: 'Floriente Cattery — вас додано до списку очікування',
    paragraphs: [
      'Дякуємо, що приєдналися до списку очікування Floriente Cattery. Ми отримали ваші дані.',
      'Кошенята народилися 6 липня 2026 року і будуть готові до переїзду в нові домівки після 6 жовтня 2026 року, у віці 3 місяців.',
      'Запис до списку очікування не гарантує бронювання. Ми обов’язково напишемо вам.',
    ],
    signature: 'З теплом,\nЕльвіра — Floriente Cattery',
  },
  pl: {
    subject: 'Floriente Cattery — jesteś na liście oczekujących',
    paragraphs: [
      'Dziękujemy za dołączenie do listy oczekujących Floriente Cattery. Otrzymaliśmy Twoje dane.',
      'Kocięta urodziły się 6 lipca 2026 i będą gotowe do nowych domów po 6 października 2026, w wieku 3 miesięcy.',
      'Dołączenie do listy oczekujących nie gwarantuje rezerwacji. Na pewno się odezwiemy.',
    ],
    signature: 'Serdecznie pozdrawiam,\nElvira — Floriente Cattery',
  },
  de: {
    subject: 'Floriente Cattery — Sie stehen auf der Warteliste',
    paragraphs: [
      'Vielen Dank für Ihren Eintrag in die Warteliste von Floriente Cattery. Wir haben Ihre Angaben erhalten.',
      'Die Kätzchen sind am 6. Juli 2026 geboren und nach dem 6. Oktober 2026 im Alter von 3 Monaten bereit für ihr neues Zuhause.',
      'Der Eintrag in die Warteliste garantiert keine Reservierung. Wir melden uns bei Ihnen.',
    ],
    signature: 'Herzliche Grüße,\nElvira — Floriente Cattery',
  },
  ru: {
    subject: 'Floriente Cattery — вы в листе ожидания',
    paragraphs: [
      'Спасибо, что записались в лист ожидания Floriente Cattery. Мы получили ваши данные.',
      'Котята родились 6 июля 2026 года и будут готовы к переезду в новый дом после 6 октября 2026 года, в возрасте 3 месяцев.',
      'Запись в лист ожидания не гарантирует бронирование. Мы обязательно напишем вам.',
    ],
    signature: 'С теплом,\nЭльвира — Floriente Cattery',
  },
};
