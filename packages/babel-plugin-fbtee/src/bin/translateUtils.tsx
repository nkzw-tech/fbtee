import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import FbtHashKey from '../fbtHashKey.tsx';
import nullthrows from '../nullthrows.tsx';
import { FbtSite } from '../translate/FbtSite.tsx';
import type {
  HashToTranslation,
  TranslationResult,
} from '../translate/TranslationBuilder.tsx';
import TranslationBuilder from '../translate/TranslationBuilder.tsx';
import TranslationConfig from '../translate/TranslationConfig.tsx';
import type { SerializedTranslationData } from '../translate/TranslationData.tsx';
import TranslationData from '../translate/TranslationData.tsx';
import type { PatternHash, PatternString } from '../Types.ts';
import type { CollectFbtOutput, CollectFbtOutputPhrase } from './collect.tsx';

export type Options = Readonly<{
  hashModule: boolean | string;
  jenkins: boolean;
  strict: boolean;
}>;

export type LocaleToHashToTranslationResult = {
  [fbLocale: string]: Partial<Record<PatternHash, TranslationResult>>;
};

/** Phrases translated for a specific locale */
type TranslatedGroup = Readonly<{
  ['fb-locale']: string;
  translatedPhrases: ReadonlyArray<TranslationResult>;
}>;

export type TranslatedGroups = ReadonlyArray<TranslatedGroup>;

/** Translations in a specific locale */
export type TranslationGroup = Readonly<{
  ['fb-locale']: string;
  translations: Translations;
}>;

export type Translations = Partial<
  Record<PatternString, SerializedTranslationData | null>
>;

/** Phrases and translation data in one JSON object */
type InputJSONType = Readonly<{
  phrases: ReadonlyArray<CollectFbtOutputPhrase>;
  translationGroups: ReadonlyArray<TranslationGroup>;
}>;

export function loadJSON<T>(filepath: string): T {
  try {
    return JSON.parse(readFileSync(filepath).toString());
  } catch (error) {
    if (error instanceof Error) {
      error.message += `\nFile path: "${filepath}"`;
    }
    throw error;
  }
}

export async function processFiles(
  stringFile: string,
  translationFiles: ReadonlyArray<string>,
  options: Options,
): Promise<LocaleToHashToTranslationResult> {
  const { phrases } = loadJSON<CollectFbtOutput>(stringFile);
  const fbtSites = phrases.map(createFbtSiteFromJSON);
  return await processGroups(
    phrases,
    translationFiles.map((file) =>
      processTranslations(fbtSites, loadJSON<TranslationGroup>(file), options),
    ),
    options,
  );
}

export async function processJSON(
  json: InputJSONType,
  options: Options,
): Promise<LocaleToHashToTranslationResult | TranslatedGroups> {
  const fbtSites = json.phrases.map(createFbtSiteFromJSON);
  return await processGroups(
    json.phrases,
    json.translationGroups.map((group) =>
      processTranslations(fbtSites, group, options),
    ),
    options,
  );
}

async function processGroups(
  phrases: ReadonlyArray<CollectFbtOutputPhrase>,
  translatedGroups: TranslatedGroups,
  options: Options,
): Promise<LocaleToHashToTranslationResult> {
  let fbtHash: typeof FbtHashKey | null = null;
  if (options.jenkins) {
    fbtHash = (await import('../fbtHashKey.tsx')).default;
  } else if (typeof options.hashModule === 'string') {
    fbtHash = (await import(pathToFileURL(options.hashModule).href)).default;
  }

  if (!fbtHash) {
    return translatedGroups as unknown as LocaleToHashToTranslationResult;
  }

  const localeToHashToFbt: LocaleToHashToTranslationResult = {};
  for (const group of translatedGroups) {
    const hashToFbt: Partial<Record<string, TranslationResult>> =
      (localeToHashToFbt[group['fb-locale']] = {});
    phrases.forEach((phrase, idx) => {
      const translatedFbt = group.translatedPhrases[idx];
      const jsfbt = nullthrows(
        phrase.jsfbt,
        `Expect every phrase to have 'jsfbt' field. However, 'jsfbt' is missing in the phrase at index ${idx}.`,
      );
      const hash = nullthrows(fbtHash)(jsfbt.t);
      hashToFbt[hash] = translatedFbt;
    });
  }
  return localeToHashToFbt;
}

function checkAndFilterTranslations(
  locale: string,
  translations: Translations,
  options: Options,
): Translations {
  const filteredTranslations: Translations = {};
  for (const hash of Object.keys(translations)) {
    if (translations[hash] == null) {
      const message = `Missing ${locale} translation for string (${hash})`;
      if (options.strict) {
        throw new Error(message);
      } else {
        console.error(message);
      }
    } else {
      filteredTranslations[hash] = translations[hash];
    }
  }
  return filteredTranslations;
}

function processTranslations(
  fbtSites: ReadonlyArray<FbtSite>,
  group: TranslationGroup,
  options: Options,
): TranslatedGroup {
  const config = TranslationConfig.fromFBLocale(group['fb-locale']);
  const filteredTranslations = checkAndFilterTranslations(
    group['fb-locale'],
    group.translations,
    options,
  );
  const translations: HashToTranslation = {};
  for (const t of Object.keys(filteredTranslations)) {
    translations[t] = TranslationData.fromJSON(filteredTranslations[t]);
  }
  const translatedPhrases = fbtSites.map((fbtsite) =>
    new TranslationBuilder(translations, config, fbtsite, false).build(),
  );
  return {
    'fb-locale': group['fb-locale'],
    translatedPhrases,
  };
}

function createFbtSiteFromJSON(json: CollectFbtOutputPhrase): FbtSite {
  return FbtSite.fromScan(json);
}
