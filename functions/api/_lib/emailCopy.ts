// Localized auto-reply copy. Lives here (not in the Astro i18n bundle) because
// the Pages Function runtime is separate from the static build. Plain text +
// minimal HTML. Mirrors the on-page expectations (early July 2026, 2–3 months,
// no guarantee, contacted in order by fit).
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
      'Kittens are expected in early July 2026 and will be ready for their new homes in approximately 2–3 months.',
      'Joining the waitlist does not guarantee a reservation. We contact suitable applicants in order, based on fit, and will be in touch with you.',
    ],
    signature: 'Warm regards,\nElvira — Floriente Cattery',
  },
  uk: {
    subject: 'Floriente Cattery — вас додано до списку очікування',
    paragraphs: [
      'Дякуємо, що приєдналися до списку очікування Floriente Cattery. Ми отримали ваші дані.',
      'Кошенята очікуються на початку липня 2026 року та будуть готові до переїзду в нові домівки приблизно за 2–3 місяці.',
      'Запис до списку очікування не гарантує бронювання. Ми зв’язуємося з відповідними кандидатами по черзі, виходячи з відповідності, і обов’язково напишемо вам.',
    ],
    signature: 'З теплом,\nЕльвіра — Floriente Cattery',
  },
  pl: {
    subject: 'Floriente Cattery — jesteś na liście oczekujących',
    paragraphs: [
      'Dziękujemy za dołączenie do listy oczekujących Floriente Cattery. Otrzymaliśmy Twoje dane.',
      'Kocięta spodziewane są na początku lipca 2026 roku i będą gotowe do nowych domów za około 2–3 miesiące.',
      'Dołączenie do listy oczekujących nie gwarantuje rezerwacji. Kontaktujemy się z odpowiednimi kandydatami po kolei, w oparciu o dopasowanie, i na pewno się odezwiemy.',
    ],
    signature: 'Serdecznie pozdrawiam,\nElvira — Floriente Cattery',
  },
  de: {
    subject: 'Floriente Cattery — Sie stehen auf der Warteliste',
    paragraphs: [
      'Vielen Dank für Ihren Eintrag in die Warteliste von Floriente Cattery. Wir haben Ihre Angaben erhalten.',
      'Die Kätzchen werden Anfang Juli 2026 erwartet und sind in etwa 2–3 Monaten bereit für ihr neues Zuhause.',
      'Der Eintrag in die Warteliste garantiert keine Reservierung. Wir kontaktieren passende Interessenten der Reihe nach, basierend auf der Eignung, und melden uns bei Ihnen.',
    ],
    signature: 'Herzliche Grüße,\nElvira — Floriente Cattery',
  },
  ru: {
    subject: 'Floriente Cattery — вы в листе ожидания',
    paragraphs: [
      'Спасибо, что записались в лист ожидания Floriente Cattery. Мы получили ваши данные.',
      'Котята ожидаются в начале июля 2026 года и будут готовы к переезду в новый дом примерно через 2–3 месяца.',
      'Запись в лист ожидания не гарантирует бронирование. Мы связываемся с подходящими кандидатами по очереди, исходя из соответствия, и обязательно напишем вам.',
    ],
    signature: 'С теплом,\nЭльвира — Floriente Cattery',
  },
};
