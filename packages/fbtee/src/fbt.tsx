/// <reference types="../ReactTypes.d.ts" />

import type { FbtTableKey, PatternString } from '@nkzw/babel-plugin-fbtee';
import invariant from 'invariant';
import { ReactElement } from 'react';
import FbtResult from './FbtResult.tsx';
import type {
  ParamVariationType,
  ValidPronounUsagesType,
} from './FbtRuntimeTypes.tsx';
import FbtTable from './FbtTable.tsx';
import FbtTableAccessor, { FbtTableArg } from './FbtTableAccessor.tsx';
import GenderConst from './GenderConst.tsx';
import getAllSubstitutions from './getAllSubstitutions.tsx';
import Hooks, {
  FbtInputOpts,
  FbtRuntimeInput,
  FbtTableArgs,
  ResolverFn,
} from './Hooks.tsx';
import intlNumUtils from './intlNumUtils.tsx';
import {
  getGenderVariations,
  getNumberVariations,
} from './IntlVariationResolver.tsx';
import list from './list.tsx';
import substituteTokens, { Substitutions } from './substituteTokens.tsx';
import type {
  BaseResult,
  FbtConjunction,
  FbtDelimiter,
  NestedFbtContentItems,
} from './Types.ts';

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

type ValidPronounUsages =
  (typeof ValidPronounUsages)[keyof typeof ValidPronounUsages];

/**
 * Must match implementation from babel-plugin-fbt/src/fbt-nodes/FbtPronounNode.js
 */
const getPronounGenderKey = (
  usage: ValidPronounUsages,
  gender: GenderConst,
) => {
  switch (gender) {
    case GenderConst.NOT_A_PERSON:
      return usage === ValidPronounUsages.object ||
        usage === ValidPronounUsages.reflexive
        ? GenderConst.NOT_A_PERSON
        : GenderConst.UNKNOWN_PLURAL;

    case GenderConst.FEMALE_SINGULAR:
      return GenderConst.FEMALE_SINGULAR;

    case GenderConst.MALE_SINGULAR:
      return GenderConst.MALE_SINGULAR;

    case GenderConst.UNKNOWN_PLURAL:
      return GenderConst.UNKNOWN_PLURAL;

    case GenderConst.UNKNOWN_SINGULAR:
      return usage === ValidPronounUsages.reflexive
        ? GenderConst.NOT_A_PERSON
        : GenderConst.UNKNOWN_PLURAL;
  }
};

export type Variations =
  | [variation: ParamVariationType['number'], value?: number | null]
  | [variation: ParamVariationType['gender'], value: GenderConst];

export function createRuntime<P, T extends BaseResult>({
  getResult,
  param,
  plural,
}: {
  getResult: ResolverFn<T>;
  param: (label: string, value: P, variations?: Variations) => FbtTableArg;
  plural: (count: number, label?: string | null, value?: P) => FbtTableArg;
}) {
  const cachedResults = new Map<PatternString, T>();
  return Object.assign(
    (_: string, __?: string, ___?: unknown) => {
      throw new Error(
        `fbt must be used with its corresponding babel plugin. Please install the babel plugin and try again.`,
      );
    },
    {
      _: (
        inputTable: FbtRuntimeInput,
        inputArgs?: FbtTableArgs | null,
        options?: FbtInputOpts | null,
      ): T => {
        let { args, table } = Hooks.getTranslatedInput({
          args: inputArgs || null,
          options: options || null,
          table: inputTable,
        });

        let substitutions: Substitutions | null = null;

        if (table.__vcg != null) {
          if (!args) {
            args = [];
          }
          args.unshift(
            FbtTableAccessor.getGenderResult(
              getGenderVariations(Hooks.getViewerContext().GENDER),
              null,
            ),
          );
        }

        const tokens: Array<FbtTableKey> = [];
        if (args) {
          if (typeof table !== 'string') {
            const newPattern = FbtTable.access(table, args, 0, tokens);
            if (newPattern) {
              table = newPattern;
            }
          }

          invariant(table !== null, 'Table access failed');
          substitutions = getAllSubstitutions(args);
        }

        const patternString = Array.isArray(table) ? table[0] : table;
        if (typeof patternString !== 'string') {
          throw new Error(
            `Table access did not result in string: ${table === undefined ? 'undefined' : JSON.stringify(table)}, Type: ${typeof table}`,
          );
        }

        const cachedFbt = cachedResults.get(patternString);
        if (cachedFbt && !substitutions) {
          return cachedFbt;
        } else {
          const fbtContent = substituteTokens(patternString, substitutions);
          const result = getResult(
            typeof fbtContent === 'string'
              ? [fbtContent]
              : (fbtContent as NestedFbtContentItems),
            options?.hk,
            Hooks.getErrorListener({
              hash: options?.hk,
              translation: patternString,
            }),
          );
          if (!substitutions) {
            cachedResults.set(patternString, result);
          }
          return result;
        }
      },
      _enum: (
        value: FbtTableKey,
        range: {
          [enumKey: string]: string;
        },
      ) => {
        if (process.env.NODE_ENV === 'development') {
          invariant(value in range, 'invalid value: %s', value);
        }
        return FbtTableAccessor.getEnumResult(value);
      },
      _implicitParam: (label: string, value: P, variations?: Variations) =>
        param(label, value, variations),
      _list: (
        label: string,
        items: ReadonlyArray<string | ReactElement | null | undefined>,
        conjunction?: FbtConjunction,
        delimiter?: FbtDelimiter,
      ) => [
        null,
        {
          [label]: list(items, conjunction, delimiter),
        },
      ],

      _name: (label: string, value: P, gender: GenderConst) =>
        FbtTableAccessor.getGenderResult(getGenderVariations(gender), {
          [label]: value,
        }),

      _param: param,
      _plural: plural,

      _pronoun: (
        usage: ValidPronounUsages,
        gender: GenderConst,
        options?: {
          human?: 1;
        } | null,
      ) => {
        invariant(
          gender !== GenderConst.NOT_A_PERSON || !options || !options.human,
          'Gender cannot be GenderConst.NOT_A_PERSON if you set "human" to true',
        );
        return FbtTableAccessor.getPronounResult(
          getPronounGenderKey(usage, gender),
        );
      },

      _subject: (value: GenderConst) =>
        FbtTableAccessor.getGenderResult(getGenderVariations(value), null),
    } as const,
  );
}

export default createRuntime<string | number, FbtResult>({
  getResult: Hooks.getFbtResult,
  param: (label: string, value: number | string, variations?: Variations) => {
    const substitution = { [label]: value };
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
          substitution,
        );
      } else {
        invariant(false, 'Unknown invariant mask');
      }
    } else {
      return FbtTableAccessor.getSubstitution(substitution);
    }
  },
  plural: (count: number, label?: string | null, value?: number | string) =>
    FbtTableAccessor.getNumberResult(
      getNumberVariations(count),
      label
        ? {
            [label]:
              typeof value === 'number'
                ? intlNumUtils.formatNumberWithThousandDelimiters(value)
                : value ||
                  intlNumUtils.formatNumberWithThousandDelimiters(count),
          }
        : null,
    ),
});
