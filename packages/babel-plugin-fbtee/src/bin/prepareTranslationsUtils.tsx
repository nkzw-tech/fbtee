import type { SerializedTranslationData } from '../translate/TranslationData.tsx';
import type { PatternString } from '../Types.ts';
import type { HashToLeaf } from './FbtCollector.tsx';
import type { Translations } from './translateUtils.tsx';

export type TranslationsWithMetadata = Partial<
  Record<
    PatternString,
    | (SerializedTranslationData & { description?: string; status?: string })
    | null
  >
>;

export const updateTranslations = (
  phrases: HashToLeaf,
  translations: Translations,
  sortByHash = false,
): TranslationsWithMetadata => {
  const hashes = new Set(Object.keys(phrases));
  const translatedHashes = new Set(Object.keys(translations));
  const newHashes = [...hashes].filter((hash) => !translatedHashes.has(hash));
  const removedHashes = [...translatedHashes].filter(
    (hash) => !hashes.has(hash),
  );

  const updatedTranslations: TranslationsWithMetadata = { ...translations };
  for (const hash of newHashes) {
    if (!updatedTranslations[hash]) {
      const phrase = phrases[hash];
      if (phrase) {
        updatedTranslations[hash] = {
          description: phrase.desc,
          status: 'new',
          tokens: [],
          translations: [
            {
              translation: phrase.text,
              variations: {},
            },
          ],
          types: [],
        };
      }
    }
  }

  for (const hash of removedHashes) {
    if (updatedTranslations[hash]) {
      delete updatedTranslations[hash];
    }
  }

  if (sortByHash) {
    return Object.fromEntries(
      Object.keys(updatedTranslations)
        .sort()
        .map((hash) => [hash, updatedTranslations[hash]]),
    );
  }

  return updatedTranslations;
};
