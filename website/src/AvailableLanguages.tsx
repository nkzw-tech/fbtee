const AvailableLanguageEntries = [
  ['en-US', 'English'],
  ['ja-JP', '日本語 (Japanese)'],
  ['de-DE', 'Deutsch (German)'],
  ['fr-FR', 'Français (French)'],
  ['es-419', 'Español (Spanish)'],
  ['it-IT', 'Italiano (Italian)'],
  ['ru-RU', 'Русский (Russian)'],
  ['ar', 'العربية (Arabic)'],
  ['he-IL', 'עברית (Hebrew)'],
  ['fb-HX', 'Pirate (Hack)'],
  ['de-AT', 'Dialekt (Austrian German)'],
] as const;

export type AvailableLocale = (typeof AvailableLanguageEntries)[number][0];

export const LegacyLocaleAliases = new Map<string, AvailableLocale>([
  ['en_US', 'en-US'],
  ['ja_JP', 'ja-JP'],
  ['de_DE', 'de-DE'],
  ['fr_FR', 'fr-FR'],
  ['es_LA', 'es-419'],
  ['it_IT', 'it-IT'],
  ['ru_RU', 'ru-RU'],
  ['ar_AR', 'ar'],
  ['he_IL', 'he-IL'],
  ['fb_HX', 'fb-HX'],
  ['de_AT', 'de-AT'],
]);

export default new Map<AvailableLocale, string>(AvailableLanguageEntries);
