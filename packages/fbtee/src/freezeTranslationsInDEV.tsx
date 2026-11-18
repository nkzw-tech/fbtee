import type { TranslationDictionary } from './FbtTranslations.tsx';

const frozenDictionaries = process.env.NODE_ENV !== 'production' ? new WeakSet<object>() : null;

function getDataProperty<T extends object>(
  value: T,
  key: string,
): TypedPropertyDescriptor<unknown> {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
  if (!('value' in descriptor)) {
    throw new TypeError('Translation catalogs must contain data properties, not accessors.');
  }
  return descriptor;
}

function freezeBranch(value: unknown): void {
  if (value && typeof value === 'object') {
    for (const key of Object.getOwnPropertyNames(value)) {
      freezeBranch(getDataProperty(value, key).value);
    }
    Object.freeze(value);
  }
}

function freezeLocale(translations: TranslationDictionary[string]) {
  if (frozenDictionaries && !frozenDictionaries.has(translations)) {
    freezeBranch(translations);
    frozenDictionaries.add(translations);
  }
}

export default function freezeTranslationsInDEV<T extends TranslationDictionary>(
  translations: T,
): T {
  if (frozenDictionaries && !frozenDictionaries.has(translations)) {
    for (const locale of Object.getOwnPropertyNames(translations)) {
      freezeLocale(getDataProperty(translations, locale).value as TranslationDictionary[string]);
    }
    Object.freeze(translations);
    frozenDictionaries.add(translations);
  }
  return translations;
}
