/// <reference types="./ReactTypes.d.ts" />

import type { FbtTableKey, PatternHash, PatternString } from 'babel-plugin-fbt';
import invariant from 'invariant';
import FbtHooks, {
  FbtInputOpts,
  FbtRuntimeInput,
  FbtTableArgs,
} from './FbtHooks.tsx';
import FbtResult from './FbtResult.tsx';
import FbtResultBase from './FbtResultBase.tsx';
import type {
  ParamVariationType,
  ValidPronounUsagesType,
} from './FbtRuntimeTypes.tsx';
import FbtTable from './FbtTable.tsx';
import FbtTableAccessor, { FbtTableArg } from './FbtTableAccessor.tsx';
import GenderConst from './GenderConst.tsx';
import getAllSubstitutions from './getAllSubstitutions.tsx';
import intlNumUtils from './intlNumUtils.tsx';
import {
  getGenderVariations,
  getNumberVariations,
} from './IntlVariationResolver.tsx';
import substituteTokens, { Substitutions } from './substituteTokens.tsx';
import { NestedFbtContentItems } from './Types.tsx';

const ParamVariation: ParamVariationType = {
  gender: 1,
  number: 0,
};

const ValidPronounUsages: ValidPronounUsagesType = {
  object: 0,
  possessive: 1,
  reflexive: 2,
  subject: 3,
};

const cachedFbtResults: Partial<Record<PatternString, FbtResult>> = {};

/**
 * fbt._enum() takes an enum value and returns a tuple in the format:
 * [value, null]
 * @param value - Example: "id1"
 * @param range - Example: {"id1": "groups", "id2": "videos", ...}
 */
function fbtEnum(
  value: FbtTableKey,
  range: {
    [enumKey: string]: string;
  }
): FbtTableArg {
  if (process.env.NODE_ENV === 'development') {
    invariant(value in range, 'invalid value: %s', value);
  }
  return FbtTableAccessor.getEnumResult(value);
}

/**
 * fbt._subject() takes a gender value and returns a tuple in the format:
 * [variation, null]
 * @param value - Example: "16777216"
 */
function fbtSubject(value: GenderConst): FbtTableArg {
  return FbtTableAccessor.getGenderResult(getGenderVariations(value), null);
}

/**
 * fbt._param() takes a `label` and `value` returns a tuple in the format:
 * [?variation, {label: "replaces {label} in pattern string"}]
 * @param label - Example: "label"
 * @param value
 *   - E.g. 'replaces {label} in pattern'
 * @param variations Variation type and variation value (if explicitly provided)
 *   E.g.
 *   number: `[0]`, `[0, count]`, or `[0, foo.someNumber() + 1]`
 *   gender: `[1, someGender]`
 */
function fbtParam(
  label: string,
  value: unknown,
  variations?:
    | [variation: ParamVariationType['number'], value?: number | null]
    | [variation: ParamVariationType['gender'], value: GenderConst]
): FbtTableArg {
  const substitution: {
    [key: string]: unknown;
  } = { [label]: value };
  if (variations) {
    if (variations[0] === ParamVariation.number) {
      const number = variations.length > 1 ? variations[1] : value;
      invariant(typeof number === 'number', 'fbt.param expected number');

      const variation = getNumberVariations(number); // this will throw if `number` is invalid
      if (typeof value === 'number') {
        substitution[label] =
          intlNumUtils.formatNumberWithThousandDelimiters(value);
      }
      return FbtTableAccessor.getNumberResult(variation, substitution);
    } else if (variations[0] === ParamVariation.gender) {
      const gender = variations[1];
      invariant(gender != null, 'expected gender value');
      return FbtTableAccessor.getGenderResult(
        getGenderVariations(gender),
        substitution
      );
    } else {
      invariant(false, 'Unknown invariant mask');
    }
  } else {
    return FbtTableAccessor.getSubstitution(substitution);
  }
}

/**
 * fbt._plural() takes a `count` and 2 optional params: `label` and `value`.
 * It returns a tuple in the format:
 * [?variation, {label: "replaces {label} in pattern string"}]
 * @param count - Example: 2
 * @param label
 *   - E.g. 'replaces {number} in pattern'
 * @param value
 *   - The value to use (instead of count) for replacing {label}
 */
function fbtPlural(
  count: number,
  label?: string | null,
  value?: unknown
): FbtTableArg {
  const variation = getNumberVariations(count);
  const substitution: {
    [key: string]: unknown;
  } = {};
  if (label) {
    substitution[label] =
      typeof value === 'number'
        ? intlNumUtils.formatNumberWithThousandDelimiters(value)
        : value || intlNumUtils.formatNumberWithThousandDelimiters(count);
  }
  return FbtTableAccessor.getNumberResult(variation, substitution);
}

/**
 * fbt._pronoun() takes a 'usage' string and a GenderConst value and returns a tuple in the format:
 * [variations, null]
 * @param usage - Example: PronounUsage.object.
 * @param gender - Example: GenderConst.MALE_SINGULAR
 * @param options - Example: { human: 1 }
 */
function fbtPronoun(
  usage: (typeof ValidPronounUsages)[keyof typeof ValidPronounUsages],
  gender: GenderConst,
  options?: {
    human?: 1;
  } | null
): FbtTableArg {
  invariant(
    gender !== GenderConst.NOT_A_PERSON || !options || !options.human,
    'Gender cannot be GenderConst.NOT_A_PERSON if you set "human" to true'
  );

  const genderKey = getPronounGenderKey(usage, gender);
  return FbtTableAccessor.getPronounResult(genderKey);
}

/**
 * Must match implementation from babel-plugin-fbt/src/fbt-nodes/FbtPronounNode.js
 */
function getPronounGenderKey(usage: 0 | 1 | 2 | 3, gender: GenderConst) {
  switch (gender) {
    case GenderConst.NOT_A_PERSON:
      return usage === ValidPronounUsages.object ||
        usage === ValidPronounUsages.reflexive
        ? GenderConst.NOT_A_PERSON
        : GenderConst.UNKNOWN_PLURAL;

    case GenderConst.FEMALE_SINGULAR:
    case GenderConst.FEMALE_SINGULAR_GUESS:
      return GenderConst.FEMALE_SINGULAR;

    case GenderConst.MALE_SINGULAR:
    case GenderConst.MALE_SINGULAR_GUESS:
      return GenderConst.MALE_SINGULAR;

    case GenderConst.MIXED_UNKNOWN:
    case GenderConst.FEMALE_PLURAL:
    case GenderConst.MALE_PLURAL:
    case GenderConst.NEUTER_PLURAL:
    case GenderConst.UNKNOWN_PLURAL:
      return GenderConst.UNKNOWN_PLURAL;

    case GenderConst.NEUTER_SINGULAR:
    case GenderConst.UNKNOWN_SINGULAR:
      return usage === ValidPronounUsages.reflexive
        ? GenderConst.NOT_A_PERSON
        : GenderConst.UNKNOWN_PLURAL;
  }

  // Mirrors the behavior of :fbt:pronoun when an unknown gender value is given.
  return GenderConst.NOT_A_PERSON;
}

/**
 * fbt.name() takes a `label`, `value`, and `gender` and
 * returns a tuple in the format:
 * [gender, {label: "replaces {label} in pattern string"}]
 * @param label - Example: "label"
 * @param value
 *   - E.g. 'replaces {label} in pattern'
 * @param gender - Example: "IntlVariations.GENDER_FEMALE"
 */
function fbtName(
  label: string,
  value: unknown,
  gender: GenderConst
): FbtTableArg {
  const variation = getGenderVariations(gender);
  const substitution: {
    [key: string]: unknown;
  } = {};
  substitution[label] = value;
  return FbtTableAccessor.getGenderResult(variation, substitution);
}

function wrapContent(
  fbtContent: NestedFbtContentItems | string,
  translation: PatternString,
  hash?: PatternHash | null
): FbtResult {
  const contents = typeof fbtContent === 'string' ? [fbtContent] : fbtContent;
  const errorListener = FbtHooks.getErrorListener({
    hash,
    translation,
  });
  const result = FbtHooks.getFbtResult({
    contents,
    errorListener,
    patternHash: hash,
    patternString: translation,
  });
  return result;
}

function isFbtInstance(value: unknown): value is FbtResultBase {
  // eslint-disable-next-line @nkzw/no-instanceof
  return value instanceof FbtResultBase;
}

const fbt = function () {};
/**
 * fbt._() iterates through all indices provided in `args` and accesses
 * the relevant entry in the `table` resulting in the appropriate
 * pattern string.  It then substitutes all relevant substitutions.
 *
 * @param inputTable - Example: {
 *   "singular": "You have a cat in a photo album named {title}",
 *   "plural": "You have cats in a photo album named {title}"
 * }
 * -or-
 * {
 *   "singular": ["You have a cat in a photo album named {title}", <hash>],
 *   "plural": ["You have cats in a photo album named {title}", <hash>]
 * }
 *
 * or table can simply be a pattern string:
 *   "You have a cat in a photo album named {title}"
 * -or-
 *    ["You have a cat in a photo album named {title}", <hash>]
 *
 * @param inputArgs - arguments from which to pull substitutions
 *    Example: [["singular", null], [null, {title: "felines!"}]]
 *
 * @param options - options for runtime
 * translation dictionary access. hk stands for hash key which is used to look
 * up translated payload in React Native.
 */
fbt._ = function fbtCallsite(
  inputTable: FbtRuntimeInput,
  inputArgs?: FbtTableArgs | null,
  options?: FbtInputOpts | null
): FbtResult {
  let { args, table: pattern } = FbtHooks.getTranslatedInput({
    args: inputArgs || null,
    options: options || null,
    table: inputTable,
  });

  let allSubstitutions: Substitutions = {};

  if (pattern.__vcg != null) {
    args = args || [];
    const { GENDER } = FbtHooks.getViewerContext();
    const variation = getGenderVariations(GENDER);
    args.unshift(FbtTableAccessor.getGenderResult(variation, null));
  }

  const tokens: Array<FbtTableKey> = [];
  if (args) {
    if (typeof pattern !== 'string') {
      // On mobile, table can be accessed at the native layer when fetching
      // translations. If pattern is not a string here, table has not been accessed
      const newPattern = FbtTable.access(pattern, args, 0, tokens);
      if (newPattern) {
        pattern = newPattern;
      }
    }

    allSubstitutions = getAllSubstitutions(args);
    invariant(pattern !== null, 'Table access failed');
  }

  let patternString, patternHash;
  if (Array.isArray(pattern)) {
    patternString = pattern[0];
    patternHash = pattern[1];
    const impressionOptions = {
      inputTable,
      tokens,
    } as const;
    FbtHooks.logImpression(patternHash, impressionOptions);
  } else if (typeof pattern === 'string') {
    patternString = pattern;
  } else {
    throw new Error(
      'Table access did not result in string: ' +
        (pattern === undefined ? 'undefined' : JSON.stringify(pattern)) +
        ', Type: ' +
        typeof pattern
    );
  }

  const cachedFbt = this.cachedResults[patternString];
  const hasSubstitutions = Object.keys(allSubstitutions).length > 0;

  if (cachedFbt && !hasSubstitutions) {
    return cachedFbt;
  } else {
    const fbtContent = substituteTokens(patternString, allSubstitutions);
    // Use `this` so that `fbs` can have its own variant.
    const result = this._wrapContent(
      fbtContent as NestedFbtContentItems,
      patternString,
      patternHash
    );
    if (!hasSubstitutions) {
      this.cachedResults[patternString] = result;
    }
    return result;
  }
};
fbt._enum = fbtEnum;
fbt._implicitParam = function fbtImplicitParam(
  label: string,
  value: unknown,
  variations?:
    | [ParamVariationType['number'], number | null]
    | [ParamVariationType['gender'], GenderConst]
): FbtTableArg {
  return this._param(label, value, variations);
};

fbt._name = fbtName;
fbt._param = fbtParam;
fbt._plural = fbtPlural;
fbt._pronoun = fbtPronoun;
fbt._subject = fbtSubject;
fbt._wrapContent = wrapContent;
fbt.isFbtInstance = isFbtInstance;
fbt.cachedResults = cachedFbtResults;

fbt._getCachedFbt = function (s: string): FbtResult | undefined {
  return process.env.NODE_ENV === 'development'
    ? this.cachedResults[s]
    : undefined;
};

export default fbt;
