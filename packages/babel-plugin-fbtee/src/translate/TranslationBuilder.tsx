import invariant from 'invariant';
import { varDump } from '../FbtUtil.tsx';
import nullthrows from '../nullthrows.tsx';
import replaceClearTokensWithTokenAliases from '../replaceClearTokensWithTokenAliases.tsx';
import type { FbtTableKey, PatternHash } from '../Types.ts';
import { FbtSite, FbtSiteMetaEntry } from './FbtSite.tsx';
import type { FbtSiteHashifiedTableJSFBTTree } from './FbtSiteBase.tsx';
import type {
  IntlVariationMaskValue,
  IntlVariations,
} from './IntlVariations.tsx';
import {
  EXACTLY_ONE,
  FbtVariationType,
  Gender,
  getType,
  IntlNumberVariations,
  isValidValue,
  Mask,
  VIEWING_USER,
} from './IntlVariations.tsx';
import type TranslationConfig from './TranslationConfig.tsx';
import TranslationData from './TranslationData.tsx';
import type { ConstraintKey } from './VariationConstraintUtils.tsx';
import { buildConstraintKey } from './VariationConstraintUtils.tsx';

/**
 * Map from a string's hash to its translation payload.
 * If the translation is string type, it implies it was machine generated.
 */
export type HashToTranslation = Partial<
  Record<PatternHash, TranslationData | string | null>
>;

/**
 * Leaf can be either a string translation or
 * a tuple of translation and hash if `inclHash` is true
 */
type TranslationLeaf =
  | string
  | null
  | undefined
  | [string | null | undefined, PatternHash];

type TranslationTree =
  | TranslationLeaf
  | number
  | Partial<
      Record<
        FbtTableKey,
        | TranslationLeaf
        | Partial<
            Record<
              FbtTableKey,
              TranslationLeaf | Partial<Record<FbtTableKey, TranslationLeaf>>
            >
          >
      >
    >;

/**
 * Need to add a `__vcg` field to TranslationTree when the string has a hidden
 * viewer gender token
 */
export type TranslationResult =
  | TranslationTree
  | {
      __vcg: number;
      [key: FbtTableKey]: TranslationTree;
    };

type MetadataToken = string;

/** e.g. {'name' => IntlGenderVariations.MALE} */
type TokenToConstraint = Partial<
  Record<MetadataToken, IntlVariations | Gender>
>;

/** e.g. {'name' => IntlVariationMask.GENDER} */
type TokenToMask = Partial<Record<MetadataToken, IntlVariationMaskValue>>;

/**
 * e.g. [['user', 2], ['count', 24]]
 * Ideally the type of constraint should be IntlVariationsEnum (number).
 * However, because a TranslationData's `variation` property might be in string
 * format, let's allow a constraint to be string type for now.
 */
export type TokenConstraintPairs = ReadonlyArray<
  [MetadataToken, number | string]
>;

type MutableTokenConstraintPairs = Array<[MetadataToken, number | string]>;

/** e.g. 'user%2:count%24' => 'this is a translation string' */
type ConstraintKeyToTranslation = Partial<Record<ConstraintKey, string>>;

/**
 * Given an FbtSite (source payload) and the relevant translations,
 * builds the corresponding translated payload
 */
export default class TranslationBuilder {
  readonly _config: TranslationConfig;
  readonly _fbtSite: FbtSite;
  readonly _hasTranslations: boolean;
  readonly _hasVCGenderVariation: boolean;
  readonly _inclHash: boolean;
  readonly _metadata: ReadonlyArray<FbtSiteMetaEntry | null | undefined>;
  readonly _tableOrHash: FbtSiteHashifiedTableJSFBTTree;
  readonly _tokenToMask: TokenToMask;
  readonly _translations: Readonly<HashToTranslation>;

  /**
   * @param translations Hash of a string to its translation
   * @param config Configuration for variation defaults (number/gender)
   * @param fbtSite Representation of the <fbt> or fbt() to be translated
   * @param inclHash Include hash/identifer in leaf of payloads
   */
  constructor(
    translations: Readonly<HashToTranslation>,
    config: TranslationConfig,
    fbtSite: FbtSite,
    inclHash: boolean,
  ) {
    this._translations = translations;
    this._config = config;
    this._fbtSite = fbtSite;
    this._tokenToMask = {};
    this._metadata = fbtSite.getMetadata();
    this._tableOrHash = fbtSite.getTableOrHash();
    this._hasVCGenderVariation = this._findVCGenderVariation();
    this._hasTranslations = this._translationsExist();
    this._inclHash = inclHash;

    // If a gender variation exists, add it to our table
    if (this._hasVCGenderVariation) {
      this._tableOrHash = { '*': this._tableOrHash as unknown as PatternHash };
      this._metadata = [
        FbtSiteMetaEntry.wrap({
          token: VIEWING_USER,
          type: FbtVariationType.GENDER,
        }),
        ...this._metadata,
      ];
    }

    for (let ii = 0; ii < this._metadata.length; ++ii) {
      const metadata = this._metadata[ii];
      if (metadata != null && metadata.hasVariationMask()) {
        const token = nullthrows(
          metadata.getToken(),
          'Expect `token` to not be null as the metadata has variation mask.',
        );
        this._tokenToMask[token] = nullthrows(
          metadata.getVariationMask(),
          'Expect `metadata.getVariationMask()` to be nonnull because ' +
            '`metadata.hasVariationMask() === true`.',
        );
      }
    }
  }

  hasTranslations(): boolean {
    return this._hasTranslations;
  }

  build(): TranslationResult {
    const table = this._buildRecursive(this._tableOrHash);
    if (this._hasVCGenderVariation) {
      invariant(
        table != null &&
          typeof table !== 'string' &&
          typeof table !== 'number' &&
          !Array.isArray(table),
        'Expect `table` to not be a TranslationLeaf when ' +
          'the string has a hidden viewer context token.',
      );
      // This hidden key is checked during JS fbt runtime to signal that we
      // should access the first entry of our table with the viewer's gender
      return { ...table, __vcg: 1 };
    }
    return table;
  }

  _translationsExist(): boolean {
    for (const hash of Object.keys(this._fbtSite.getHashToLeaf())) {
      const transData = this._translations[hash];
      if (
        typeof transData === 'string' ||
        (transData instanceof TranslationData && transData.hasTranslation())
      ) {
        // There is a translation or simple string for generated translation
        return true;
      }
    }
    return false;
  }

  /**
   * Inspect all translation variations for a hidden viewer context token
   */
  _findVCGenderVariation(): boolean {
    for (const hash of Object.keys(this._fbtSite.getHashToLeaf())) {
      const transData = this._translations[hash];
      if (!(transData instanceof TranslationData)) {
        continue;
      }

      for (const token of transData.tokens) {
        if (token === VIEWING_USER) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Given a hash (or hash-table), return the translated text (or table of
   * texts).  If the hash (or hashes) do not have a translation, then the
   * original text will be used as the translation.
   *
   * If we should include the string hash then the method returns a vector with
   * [string, hash] so that the hash is available to the run-time logging code.
   */
  _buildRecursive(
    hashOrTable: FbtSiteHashifiedTableJSFBTTree,
    tokenConstraints: TokenToConstraint = {},
    levelIdx: number = 0,
  ): TranslationTree {
    if (typeof hashOrTable === 'string') {
      return this._getLeafTranslation(hashOrTable, tokenConstraints);
    }

    const table: TranslationTree = {};
    for (const key of Object.keys(hashOrTable)) {
      const branchOrLeaf = hashOrTable[key]!;
      let translation: TranslationTree = this._buildRecursive(
        branchOrLeaf,
        tokenConstraints,
        levelIdx + 1,
      );
      if (_shouldStore(translation)) {
        table[key] = translation as TranslationLeaf;
      }

      // This level will have metadata if it could potentially have variations.
      // Below, we fill the table with those variation entries.
      //
      // NOTE: A key of '_1' (EXACTLY_ONE) will be processed by the
      // buildRecursive call above, as its corresponding token constraint is
      // defaulted to '*'.  See _getConstraintMap for more details
      const metadata = this._metadata[levelIdx];
      if (
        metadata != null &&
        metadata.hasVariationMask() &&
        key !== EXACTLY_ONE
      ) {
        const mask = nullthrows(
          metadata.getVariationMask(),
          'Expect mask not to be null because metadata.hasVariationMask() returns true.',
        );
        invariant(
          mask === Mask.NUMBER || mask === Mask.GENDER,
          'Unknown variation mask: %s (%s)',
          varDump(mask),
          typeof mask,
        );
        invariant(
          isValidValue(key),
          'Expect variation keys to be coercible to IntlVariationsEnum: current key=%s (%s)',
          varDump(key),
          typeof key,
        );
        const token = nullthrows(
          metadata.getToken(),
          'Expect `token` to not be falsy when the metadata has a variation mask.',
        );
        const variationCandidates = _getTypesFromMask(mask);
        variationCandidates.forEach((variationKey) => {
          tokenConstraints[token] = variationKey;
          translation = this._buildRecursive(
            branchOrLeaf,
            tokenConstraints,
            levelIdx + 1,
          );
          if (_shouldStore(translation)) {
            table[String(variationKey)] = translation as TranslationLeaf;
          }
        });
        delete tokenConstraints[token];
      }
    }
    return table;
  }

  _getLeafTranslation(
    hash: PatternHash,
    tokenConstraints: TokenToConstraint = {},
  ): TranslationLeaf {
    let translation;
    const transData: TranslationData | null | undefined | string =
      this._translations[hash];
    if (typeof transData === 'string') {
      // Fake translations are just simple strings.  There's no such thing as
      // variation support for these locales.  So if token constraints were
      // specified, return null and rely on runtime fallback to wildcard.
      translation = tokenConstraints ? null : transData;
    } else {
      if (Object.keys(tokenConstraints).length > 0) {
        translation = this.getConstrainedTranslation(hash, tokenConstraints);
      } else {
        // Real translations are TranslationData objects, so we call the
        // getDefaultTranslation() method to get the translation (we hope)
        const defaultTranslation =
          transData && transData.getDefaultTranslation(this._config);

        // If no translation available, use the English source text
        translation =
          defaultTranslation ?? this._fbtSite.getHashToLeaf()[hash]?.text;
      }
    }

    // Replace clear tokens with their token aliases
    if (translation != null) {
      translation = replaceClearTokensWithTokenAliases(
        translation,
        this._fbtSite.getHashToTokenAliases()[hash],
      );
    }

    // Couple the string with a hash if it was marked as such.  We do this
    // when logging impressions or when using QuickTranslations.  The logging
    // is performed by `fbt._(...)`
    return this._inclHash ? [translation, hash] : translation;
  }

  /**
   * Given a hash and restraints on the token variations, retrieve the
   * appropriate translation for our map.  A null entry is a signal
   * not to add the translation to the map, because it's already in
   * the map via its fallback ('*') keys.
   */
  getConstrainedTranslation(
    hash: PatternHash,
    tokenConstraints: TokenToConstraint,
  ): string | null {
    const constraintKeys: MutableTokenConstraintPairs = [];
    for (const token of Object.keys(this._tokenToMask)) {
      constraintKeys.push([token, tokenConstraints[token] || '*']);
    }
    const constraintMap = this.getConstraintMapWithMemoization(hash);
    const aggregateKey = buildConstraintKey(constraintKeys);
    const translation = constraintMap[aggregateKey];
    if (!translation) {
      return null;
    }
    for (let ii = 0; ii < constraintKeys.length; ++ii) {
      const [token, constraint] = constraintKeys[ii];
      if (constraint === '*') {
        continue;
      }

      // If any of the constraints share the same translation as the wildcard
      // (default) entry at this level, don't add an entry to the table.  They
      // will be in the table under the '*' key.
      constraintKeys[ii] = [token, '*'];
      const wildKey = buildConstraintKey(constraintKeys);
      const wildTranslation = constraintMap[wildKey];
      if (wildTranslation === translation) {
        return null;
      }
      // Set the constraint back
      constraintKeys[ii] = [token, constraint];
    }
    return translation;
  }

  _insertConstraint(
    constraintKeys: MutableTokenConstraintPairs,
    constraintMap: ConstraintKeyToTranslation,
    translation: string,
    defaultingLevel: number,
  ) {
    const aggregateKey = buildConstraintKey(constraintKeys);
    if (constraintMap[aggregateKey]) {
      throw new Error(
        'Unexpected duplicate key: ' +
          aggregateKey +
          '\nOriginal: ' +
          constraintMap[aggregateKey] +
          '\nNew ' +
          translation,
      );
    }
    constraintMap[aggregateKey] = translation;

    // Also include duplicate '*' entries if it is a default value
    for (let ii = defaultingLevel; ii < constraintKeys.length; ii++) {
      const [token, val] = constraintKeys[ii];
      if (val !== '*' && this._config.isDefaultVariation(val)) {
        constraintKeys[ii] = [token, '*'];
        this._insertConstraint(
          constraintKeys,
          constraintMap,
          translation,
          ii + 1,
        );
        constraintKeys[ii] = [token, val]; // return the value back
      }
    }
  }

  /**
   * Populates our variation constraint map.  The map is of all possible
   * variation combinations (serialized as a string) to the appropriate
   * translation.  For example, JavaScript like:
   *
   *   fbt('Hi ' + fbt.param('user', viewer.name, {gender: viewer.gender}) +
   *       ', would you like to play ' +
   *        fbt.param('count', gameCount, {number: true}) +
   *        ' games of ' + fbt.enum(game,['chess','backgammon','poker']) +
   *        '?  Click ' + fbt.param('link', <Link  />), 'sample'),
   *
   * will have variations for the 'user' and 'count' parameters.  Accounting for
   * all variations in a locale where we don't merge unknown gender into male
   * and we have the dual number variation, the map will have the following keys
   * mapping to the corresponding translation.
   *
   *  user%*:count%*  [default (unknown) - default (other) ]
   *  user%*:count%4  [default           - one             ]
   *  user%*:count%20 [default           - few             ]
   *  user%*:count%24 [default           - other           ]
   *  user%1:count%*  [male              - default (other) ]
   *  user%1:count%4  [male              - one             ]
   *  user%1:count%20 [male              - few             ]
   *  user%1:count%24 [male              - other           ]
   *  user%2:count%*  [female            - default (other) ]
   *  user%2:count%4  [female            - singular        ]
   *  user%2:count%20 [female            - few             ]
   *  user%2:count%24 [female            - other           ]
   *  user%3:count%*  [unknown gender    - default (other) ]
   *  user%3:count%4  [unknown gender    - singular        ]
   *  user%3:count%20 [unknown gender    - few             ]
   *  user%3:count%24 [unknown gender    - other           ]
   *
   *  Note we have duplicate translations in this map.  As an example, the
   *  following keys map to the same translation
   *    'user%*:count%*'  (default - default)
   *    'user%3:count%*'  (unknown - default)
   *    'user%3:count%24' (unknown - other)
   *
   *  These translations are deduped later in getConstrainedTranslation such
   *  that only the 'user%*:count%*' in our tree is in the JSON map.  i.e.
   *
   *  {
   *    // No unknown gender entry exists at this level - we rely on fallback
   *    '*' => {
   *      // no plural entry exists at this level
   *      '*' => {translation},
   *      ...
   *
   *    },
   *    ...
   *  }
   */
  private _mem = new Map<string, ConstraintKeyToTranslation>();
  private getConstraintMapWithMemoization = (
    hash: PatternHash,
  ): ConstraintKeyToTranslation => {
    const cache = this._mem.get(hash);
    if (cache != null) {
      return cache;
    }

    const constraintMap: ConstraintKeyToTranslation = {};
    const transData = this._translations[hash];
    if (transData == null || typeof transData === 'string') {
      // No translation? No constraints.
      this._mem.set(hash, constraintMap);
      return constraintMap;
    }

    // For every possible variation combination, create a mapping to its
    // corresponding translation
    transData.translations.forEach((translation) => {
      const constraints: Record<string, string | number> = {};
      for (const idx of Object.keys(translation.variations)) {
        const variation = translation.variations[idx];
        // We prune entries that contain non-default variations
        // for tokens we haven't specified.
        const token = transData.tokens[Number(idx)];
        if (
          // Token variation type not specified
          !this._tokenToMask[token] ||
          // Translated variation type is different than token variation type
          this._tokenToMask[token] !== transData.types[Number(idx)]
        ) {
          // Only add default tokens we haven't specified.
          if (!this._config.isDefaultVariation(variation)) {
            return;
          }
        }
        constraints[token] = variation;
      }
      // A note about fbt:plurals.  They can introduce global token
      // discrepancies between leaf nodes.  Singular translations don't have
      // number tokens, but their plural counterparts can (when showCount =
      // "ifMany" or "yes").  If we are dealing with the singular leaf of an
      // fbt:plural, since it has a unique hash, we can let it masquerade as
      // default: '*', since no such variation actually exists for a
      // non-existent token
      const constraintKeys: MutableTokenConstraintPairs = [];
      for (const k of Object.keys(this._tokenToMask)) {
        constraintKeys.push([k, constraints[k] || '*']);
      }
      this._insertConstraint(
        constraintKeys,
        constraintMap,
        translation.translation,
        0,
      );
    });
    this._mem.set(hash, constraintMap);
    return constraintMap;
  };
}

function _shouldStore(branch: TranslationTree): boolean {
  return (
    branch != null &&
    (typeof branch === 'string' ||
      typeof branch === 'number' ||
      Array.isArray(branch) ||
      Object.keys(branch).length > 0)
  );
}

const genders = [Gender.MALE, Gender.FEMALE, Gender.UNKNOWN];
function _getTypesFromMask(mask: IntlVariationMaskValue) {
  return getType(mask) === Mask.NUMBER
    ? Object.values(IntlNumberVariations)
    : genders;
}
