import type { TranslationDictionary } from './FbtTranslations.tsx';

const frozenDictionaries = process.env.NODE_ENV !== 'production' ? new WeakSet<object>() : null;

function getValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
  if (!('value' in descriptor)) {
    throw new TypeError('Translation catalogs must contain data properties, not accessors.');
  }
  return descriptor.value;
}

function freezeBranch(value: unknown): void {
  if (value && typeof value === 'object') {
    for (const key of Object.getOwnPropertyNames(value)) {
      freezeBranch(getValue(value, key));
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
      freezeLocale(getValue(translations, locale) as TranslationDictionary[string]);
    }
    Object.freeze(translations);
    frozenDictionaries.add(translations);
  }
  return translations;
}
