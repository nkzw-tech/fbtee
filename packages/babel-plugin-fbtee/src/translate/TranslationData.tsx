import type { IntlFbtVariationTypeValue } from './IntlVariations.tsx';
import type TranslationConfig from './TranslationConfig.tsx';

/**
 * Corresponds to IntlJSTranslatationDataEntry in Hack
 */
type Translation = {
  id?: number;
  translation: string;
  // Allow variation enum values to be stored in string or number type,
  // and we will parse it into IntlVariationEnumValue in config.isDefaultVariation()
  variations: {
    [index: string]: number | string;
  };
};

export type SerializedTranslationData = {
  tokens: ReadonlyArray<string>;
  translations: ReadonlyArray<Translation>;
  types: ReadonlyArray<IntlFbtVariationTypeValue>;
};

export default class TranslationData {
  readonly tokens: ReadonlyArray<string>;
  readonly types: ReadonlyArray<IntlFbtVariationTypeValue>;
  readonly translations: ReadonlyArray<Translation>;
  _defaultTranslation: string | null | undefined;

  constructor(
    tokens: ReadonlyArray<string>,
    types: ReadonlyArray<IntlFbtVariationTypeValue>,
    translations: ReadonlyArray<Translation>
  ) {
    this.tokens = tokens;
    this.types = types;
    this.translations = translations;
  }

  static fromJSON: (
    json?: SerializedTranslationData | null
  ) => TranslationData | null = (json) => {
    if (json == null) {
      // Hash key is logged to stderr in `processTranslations`
      return null;
    }
    return new TranslationData(json.tokens, json.types, json.translations);
  };

  hasTranslation(): boolean {
    return this.translations.length > 0;
  }

  // Makes a best effort attempt at finding the default translation.
  getDefaultTranslation(config: TranslationConfig): string | null {
    if (this._defaultTranslation === undefined) {
      for (let i = 0; i < this.translations.length; ++i) {
        const trans = this.translations[i];
        let isDefault = true;
        for (const v of Object.keys(trans.variations)) {
          if (!config.isDefaultVariation(trans.variations[v])) {
            isDefault = false;
            break;
          }
        }
        if (isDefault) {
          return (this._defaultTranslation = trans.translation);
        }
      }
      this._defaultTranslation = null;
    }
    return this._defaultTranslation;
  }
}
