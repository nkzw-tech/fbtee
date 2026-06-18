const AvailableLanguageEntries = [
  ['en_US', 'English'],
  ['ja_JP', '日本語 (Japanese)'],
  ['de_DE', 'Deutsch (German)'],
  ['fr_FR', 'Français (French)'],
  ['es_LA', 'Español (Spanish)'],
  ['it_IT', 'Italiano (Italian)'],
  ['ru_RU', 'Русский (Russian)'],
  ['ar_AR', 'العربية (Arabic)'],
  ['he_IL', 'עברית (Hebrew)'],
  ['fb_HX', 'Pirate (Hack)'],
  ['de_AT', 'Dialekt (Austrian German)'],
] as const;

export type AvailableLocale = (typeof AvailableLanguageEntries)[number][0];

export default new Map<AvailableLocale, string>(AvailableLanguageEntries);
