import invariant from 'invariant';
import type { AnyStringVariationArg } from './fbt-nodes/FbtArguments.tsx';
import {
  EnumStringVariationArg,
  GenderStringVariationArg,
  NumberStringVariationArg,
} from './fbt-nodes/FbtArguments.tsx';
import FbtElementNode from './fbt-nodes/FbtElementNode.tsx';
import FbtEnumNode from './fbt-nodes/FbtEnumNode.tsx';
import FbtImplicitParamNode from './fbt-nodes/FbtImplicitParamNode.tsx';
import FbtNameNode from './fbt-nodes/FbtNameNode.tsx';
import FbtParamNode from './fbt-nodes/FbtParamNode.tsx';
import FbtPluralNode from './fbt-nodes/FbtPluralNode.tsx';
import FbtPronounNode from './fbt-nodes/FbtPronounNode.tsx';
import { ShowCountKeys } from './FbtConstants.tsx';
import type { EnumKey } from './FbtEnumRegistrar.tsx';
import { varDump } from './FbtUtil.tsx';
import type { GenderConst } from './Gender.tsx';
import type { JSFBTMetaEntry } from './index.tsx';
import nullthrows from './nullthrows.tsx';
import {
  EXACTLY_ONE,
  FbtVariationType,
  GENDER_ANY,
  NUMBER_ANY,
  SUBJECT,
} from './translate/IntlVariations.tsx';

/**
 * Helper class to assemble the JSFBT table data.
 * It's responsible for:
 * - producing all the combinations of string variations' candidate values,
 * from a given list of string variation arguments.
 * - generating metadata to describe the meaning of each level of the JSFBT table tree.
 */
export default class JSFbtBuilder {
  /**
   * Source code that matches the nodes used in the provided `stringVariationArgs`
   */
  readonly fileSource: string;
  /**
   * Map of fbt:enum at the current recursion level of `_getStringVariationCombinations()`
   */
  readonly usedEnums: {
    [enumArgCode: string]: EnumKey;
  };
  /**
   * Map of fbt:plural at the current recursion level of `_getStringVariationCombinations()`
   */
  readonly usedPlurals: {
    [pluralsArgCode: string]: typeof EXACTLY_ONE | typeof NUMBER_ANY;
  };
  /**
   * Map of fbt:pronoun at the current recursion level of `_getStringVariationCombinations()`
   */
  readonly usedPronouns: {
    [pronounsArgCode: string]: GenderConst | typeof GENDER_ANY;
  };
  /**
   * List of string variation arguments from a given fbt callsite
   */
  readonly stringVariationArgs: ReadonlyArray<AnyStringVariationArg>;

  constructor(
    fileSource: string,
    stringVariationArgs: ReadonlyArray<AnyStringVariationArg>
  ) {
    this.fileSource = fileSource;
    this.stringVariationArgs = stringVariationArgs;
    this.usedEnums = {};
    this.usedPlurals = {};
    this.usedPronouns = {};
  }

  /**
   * Generates a list of metadata entries that describe the usage of each level
   * of the JSFBT table tree
   * @param compactStringVariationArgs Consolidated list of string variation arguments.
   * See FbtFunctionCallProcessor#_compactStringVariationArgs()
   */
  buildMetadata(
    compactStringVariationArgs: ReadonlyArray<AnyStringVariationArg>
  ): Array<JSFBTMetaEntry | null> {
    return compactStringVariationArgs.map((svArg) => {
      const { fbtNode } = svArg;

      if (fbtNode instanceof FbtPluralNode) {
        return fbtNode.options.showCount !== ShowCountKeys.no
          ? {
              singular: true,
              token: nullthrows(fbtNode.options.name),
              type: FbtVariationType.NUMBER,
            }
          : null;
      }

      if (
        fbtNode instanceof FbtElementNode ||
        fbtNode instanceof FbtImplicitParamNode
      ) {
        return {
          token: SUBJECT,
          type: FbtVariationType.GENDER,
        };
      }

      if (fbtNode instanceof FbtPronounNode) {
        return null;
      }

      if (svArg instanceof EnumStringVariationArg) {
        invariant(
          fbtNode instanceof FbtEnumNode,
          'Expected fbtNode to be an instance of FbtEnumNode but got `%s` instead',
          fbtNode.constructor.name || varDump(fbtNode)
        );

        // We ensure we have placeholders in our metadata because enums and
        // pronouns don't have metadata and will add "levels" to our resulting
        // table.
        //
        // Example for the code:
        //
        //   fbt.enum(value, {
        //     groups: 'Groups',
        //     photos: 'Photos',
        //     videos: 'Videos',
        //   })
        //
        // Expected metadata entry:
        //   for non-RN -> `null`
        //   for RN     -> `{range: ['groups', 'photos', 'videos']}`
        return null;
      }

      if (
        svArg instanceof GenderStringVariationArg ||
        svArg instanceof NumberStringVariationArg
      ) {
        invariant(
          fbtNode instanceof FbtNameNode || fbtNode instanceof FbtParamNode,
          'Expected fbtNode to be an instance of FbtNameNode or FbtParamNode but got `%s` instead',
          fbtNode.constructor.name || varDump(fbtNode)
        );
        return svArg instanceof NumberStringVariationArg
          ? {
              token: fbtNode.options.name,
              type: FbtVariationType.NUMBER,
            }
          : {
              token: fbtNode.options.name,
              type: FbtVariationType.GENDER,
            };
      }

      invariant(
        false,
        'Unsupported string variation argument: %s',
        varDump(svArg)
      );
    });
  }

  /**
   * Get all the string variation combinations derived from a list of string variation arguments.
   *
   * E.g. If we have a list of string variation arguments as:
   *
   * [genderSV, numberSV]
   *
   * Assuming genderSV produces candidate variation values as: male, female, unknown
   * Assuming numberSV produces candidate variation values as: singular, plural
   *
   * The output would be:
   *
   * [
   *   [  genderSV(male),     numberSV(singular)  ],
   *   [  genderSV(male),     numberSV(plural)    ],
   *   [  genderSV(female),   numberSV(singular)  ],
   *   [  genderSV(female),   numberSV(plural)    ],
   *   [  genderSV(unknown),  numberSV(singular)  ],
   *   [  genderSV(unknown),  numberSV(plural)    ],
   * ]
   *
   * Follows legacy behavior:
   *   - process each SV argument (FIFO),
   *   - for each SV argument of the same fbt construct (e.g. plural)
   *     (and not of the same variation type like Gender)
   *     - check if there's already an existing SV argument of the same JS code being used
   *       - if so, re-use the same variation value
   *       - else, "multiplex" new variation value
   *       Do this for plural, gender, enum
   */
  getStringVariationCombinations(): ReadonlyArray<
    ReadonlyArray<AnyStringVariationArg>
  > {
    return this._getStringVariationCombinations();
  }

  _getStringVariationCombinations(
    combos: Array<ReadonlyArray<AnyStringVariationArg>> = [],
    curArgIndex: number = 0,
    prevArgs: ReadonlyArray<AnyStringVariationArg> = []
  ): Array<ReadonlyArray<AnyStringVariationArg>> {
    invariant(
      curArgIndex >= 0,
      'curArgIndex value must greater or equal to 0, but we got `%s` instead',
      curArgIndex
    );

    if (this.stringVariationArgs.length === 0) {
      return combos;
    }

    if (curArgIndex >= this.stringVariationArgs.length) {
      combos.push(prevArgs);
      return combos;
    }

    const curArg = this.stringVariationArgs[curArgIndex];
    const { fbtNode } = curArg;
    const { usedEnums, usedPlurals, usedPronouns } = this;

    const recurse = <V,>(
      candidateValues: ReadonlyArray<V>,
      beforeRecurse?: (arg1: V) => unknown,
      isCollapsible: boolean = false
    ) =>
      candidateValues.forEach((value) => {
        if (beforeRecurse) {
          beforeRecurse(value);
        }
        this._getStringVariationCombinations(
          combos,
          curArgIndex + 1,
          prevArgs.concat(curArg.cloneWithValue(value as '*', isCollapsible))
        );
      });

    if (fbtNode instanceof FbtEnumNode) {
      invariant(
        curArg instanceof EnumStringVariationArg,
        'Expected EnumStringVariationArg but got: %s',
        varDump(curArg)
      );
      const argCode = curArg.getArgCode(this.fileSource);

      if (argCode in usedEnums) {
        const enumKey = usedEnums[argCode];
        invariant(
          enumKey in fbtNode.options.range,
          '%s not found in %s. Attempting to re-use incompatible enums',
          enumKey,
          varDump(fbtNode.options.range)
        );

        recurse([enumKey], undefined, true);
        return combos;
      }

      recurse(curArg.candidateValues, (value) => (usedEnums[argCode] = value));
      delete usedEnums[argCode];
    } else if (fbtNode instanceof FbtPluralNode) {
      invariant(
        curArg instanceof NumberStringVariationArg,
        'Expected NumberStringVariationArg but got: %s',
        varDump(curArg)
      );
      const argCode = curArg.getArgCode(this.fileSource);

      if (argCode in usedPlurals) {
        recurse([usedPlurals[argCode]]);
        return combos;
      }

      recurse(
        curArg.candidateValues,
        (value) => (usedPlurals[argCode] = value)
      );
      delete usedPlurals[argCode];
    } else if (fbtNode instanceof FbtPronounNode) {
      invariant(
        curArg instanceof GenderStringVariationArg,
        'Expected GenderStringVariationArg but got: %s',
        varDump(curArg)
      );
      const argCode = curArg.getArgCode(this.fileSource);

      if (argCode in usedPronouns) {
        recurse([usedPronouns[argCode]]);
        return combos;
      }

      recurse(
        curArg.candidateValues,
        (value) => (usedPronouns[argCode] = value)
      );
      delete usedPronouns[argCode];
    } else if (
      curArg instanceof NumberStringVariationArg ||
      curArg instanceof GenderStringVariationArg
    ) {
      recurse(
        // @ts-expect-error
        curArg.candidateValues,
        undefined,
        curArg instanceof GenderStringVariationArg &&
          fbtNode instanceof FbtImplicitParamNode
      );
    } else {
      invariant(
        false,
        'Unsupported string variation argument: %s',
        varDump(curArg)
      );
    }
    return combos;
  }
}
