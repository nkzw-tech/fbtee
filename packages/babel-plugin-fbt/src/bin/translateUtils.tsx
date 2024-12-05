import fs from 'fs';
import nullthrows from 'nullthrows';
import type { PatternHash, PatternString } from '../../../fbt/src/FbtTable';
import type {
  CollectFbtOutput,
  CollectFbtOutputPhrase,
} from '../bin/collectFbt';
import FbtHashKey from '../fbtHashKey';
import { objMap } from '../FbtUtil';
import { FbtSite } from '../translate/FbtSite';
import type { TranslationResult } from '../translate/TranslationBuilder';
import TranslationBuilder from '../translate/TranslationBuilder';
import TranslationConfig from '../translate/TranslationConfig';
import type { SerializedTranslationData } from '../translate/TranslationData';
import TranslationData from '../translate/TranslationData';

export type Options = Readonly<{
  // By default, we output the translations as an associative array whose
  // indices match the phrases provided.  If instead, you'd like a mapping
  // from the associated "jenkins" hash to translation payload (for use in
  // babel-fbt-runtime plugin, for instance) you can use this.
  jenkins: boolean;
  // Similar to `jenkins`, but pass the hash-module of your choice.
  // The module should export a function with the same signature and operation
  // of fbt-hash-module.
  hashModule: boolean | string;
  // By default, we log missing values in the translation file to stderr. If you
  // instead would like to stop execution on missing values you can use this.
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
type TranslationGroup = Readonly<{
  ['fb-locale']: string;
  translations: Translations;
}>;

type Translations = Partial<
  Record<PatternString, SerializedTranslationData | null | undefined>
>;

/** Phrases and translation data in one JSON object */
type InputJSONType = Readonly<{
  phrases: ReadonlyArray<CollectFbtOutputPhrase>;
  translationGroups: ReadonlyArray<TranslationGroup>;
}>;

function parseJSONFile<T>(filepath: string): T {
  try {
    return JSON.parse(fs.readFileSync(filepath).toString());
  } catch (error: any) {
    error.message += `\nFile path: "${filepath}"`;
    throw error;
  }
}

export function processFiles(
  stringFile: string,
  translationFiles: ReadonlyArray<string>,
  options: Options
): LocaleToHashToTranslationResult | TranslatedGroups {
  const { phrases } = parseJSONFile<CollectFbtOutput>(stringFile);
  const fbtSites = phrases.map(createFbtSiteFromJSON);
  const translatedGroups = translationFiles.map((file) => {
    const group = parseJSONFile<TranslationGroup>(file);
    return processTranslations(fbtSites, group, options);
  });
  return processGroups(phrases, translatedGroups, options);
}

export function processJSON(
  json: InputJSONType,
  options: Options
): LocaleToHashToTranslationResult | TranslatedGroups {
  const fbtSites = json.phrases.map(createFbtSiteFromJSON);
  return processGroups(
    json.phrases,
    json.translationGroups.map((group) =>
      processTranslations(fbtSites, group, options)
    ),
    options
  );
}

function processGroups(
  phrases: ReadonlyArray<CollectFbtOutputPhrase>,
  translatedGroups: TranslatedGroups,
  options: Options
): LocaleToHashToTranslationResult | TranslatedGroups {
  let fbtHash: typeof FbtHashKey | null | undefined = null;
  if (options.jenkins) {
    fbtHash = require('../fbtHashKey');
  } else if (typeof options.hashModule === 'string') {
    fbtHash = require(options.hashModule);
  }

  if (!fbtHash) {
    return translatedGroups;
  }

  const localeToHashToFbt: LocaleToHashToTranslationResult = {};
  for (const group of translatedGroups) {
    const hashToFbt: Partial<Record<string, TranslationResult>> =
      (localeToHashToFbt[group['fb-locale']] = {});
    phrases.forEach((phrase, idx) => {
      const translatedFbt = group.translatedPhrases[idx];
      const jsfbt = nullthrows(
        phrase.jsfbt,
        `Expect every phrase to have 'jsfbt' field. However, 'jsfbt' is missing in the phrase at index ${idx}.`
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
  options: Options
): Translations {
  const filteredTranslations: Translations = {};
  for (const hash in translations) {
    if (translations[hash] == null) {
      const message = `Missing ${locale} translation for string (${hash})`;
      if (options.strict) {
        const err = new Error(message);
        err.stack;
        throw err;
      } else {
        process.stderr.write(`${message}\n`);
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
  options: Options
): TranslatedGroup {
  const config = TranslationConfig.fromFBLocale(group['fb-locale']);
  const filteredTranslations = checkAndFilterTranslations(
    group['fb-locale'],
    group.translations,
    options
  );
  const translations = objMap(filteredTranslations, TranslationData.fromJSON);
  const translatedPhrases = fbtSites.map((fbtsite) =>
    new TranslationBuilder(translations, config, fbtsite, false).build()
  );
  return {
    'fb-locale': group['fb-locale'],
    translatedPhrases,
  };
}

function createFbtSiteFromJSON(json: CollectFbtOutputPhrase): FbtSite {
  return FbtSite.fromScan(json);
}
