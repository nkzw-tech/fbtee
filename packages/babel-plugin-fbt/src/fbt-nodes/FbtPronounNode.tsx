import {
  CallExpression,
  Expression,
  identifier,
  isCallExpression,
  isStringLiteral,
  numericLiteral,
  objectExpression,
  objectProperty,
} from '@babel/types';
import invariant from 'invariant';
import type {
  JSModuleNameType,
  ValidPronounUsagesKey,
} from '../FbtConstants.tsx';
import {
  ValidPronounOptions,
  ValidPronounUsages,
  ValidPronounUsagesKeys,
} from '../FbtConstants.tsx';
import FbtNodeChecker from '../FbtNodeChecker.tsx';
import type { CallExpressionArg } from '../FbtUtil.tsx';
import {
  collectOptionsFromFbtConstruct,
  createFbtRuntimeArgCallExpression,
  enforceBabelNodeCallExpressionArg,
  enforceBoolean,
  enforceStringEnum,
  errorAt,
  varDump,
} from '../FbtUtil.tsx';
import { GenderConstEnum, Genders, getData } from '../Gender.tsx';
import nullthrows from '../nullthrows.tsx';
import { GENDER_ANY } from '../translate/IntlVariations.tsx';
import type { StringVariationArgsMap } from './FbtArguments.tsx';
import { GenderStringVariationArg } from './FbtArguments.tsx';
import FbtNode from './FbtNode.tsx';
import { FbtNodeType } from './FbtNodeType.tsx';

type Options = {
  // If true, capitalize the pronoun text
  capitalize?: boolean | null | undefined;
  // BabelNodeCallExpressionArg representing the value of the `gender`
  gender: CallExpressionArg;
  // If true, exclude non-human-related pronouns from the generated string variations
  human?: boolean | null | undefined;
  // Type of pronoun
  type: ValidPronounUsagesKey;
};

const candidatePronounGenders: ReadonlyArray<GenderConstEnum> =
  consolidatedPronounGenders();

const HUMAN_OPTION = 'human';

/**
 * Represents an <fbt:pronoun> or fbt.pronoun() construct.
 * @see docs/pronouns.md
 */
export default class FbtPronounNode extends FbtNode<
  GenderStringVariationArg,
  CallExpression,
  null,
  Options
> {
  static readonly type: FbtNodeType = FbtNodeType.Pronoun;

  static fromBabelNode({
    moduleName,
    node,
  }: {
    moduleName: JSModuleNameType;
    node: Expression;
  }): FbtPronounNode | null | undefined {
    if (!isCallExpression(node)) {
      return null;
    }
    const checker = FbtNodeChecker.forModule(moduleName);
    const constructName = checker.getFbtConstructNameFromFunctionCall(node);
    return constructName === FbtPronounNode.type
      ? new FbtPronounNode({
          moduleName,
          node,
        })
      : null;
  }

  override getOptions(): Options {
    const { moduleName } = this;
    const rawOptions = collectOptionsFromFbtConstruct(
      moduleName,
      this.node,
      ValidPronounOptions
    );

    try {
      const args = this.getCallNodeArguments() || [];
      const [usageArg, genderArg] = args;
      invariant(
        isStringLiteral(usageArg),
        '`usage`, the first argument of %s.pronoun() must be a `StringLiteral` but we got `%s`',
        moduleName,
        usageArg?.type || 'unknown'
      );
      const type = enforceStringEnum(
        usageArg.value,
        ValidPronounUsages,
        `\`usage\`, the first argument of ${moduleName}.pronoun()`
      );
      const gender = enforceBabelNodeCallExpressionArg(
        genderArg,
        '`gender`, the second argument'
      );
      const mergedOptions = nullthrows(rawOptions);
      return {
        capitalize: enforceBoolean.orNull(mergedOptions.capitalize),
        gender,
        human: enforceBoolean.orNull(mergedOptions.human),
        type,
      };
    } catch (error: any) {
      throw errorAt(this.node, error);
    }
  }

  override initCheck(): void {
    const args = this.getCallNodeArguments();
    invariant(
      (args && (args.length === 2 || args.length === 3)) || !args,
      "Expected '(usage, gender [, options])' arguments to %s.pronoun()",
      this.moduleName
    );
  }

  override getText(argsMap: StringVariationArgsMap): string {
    try {
      const svArg = argsMap.get(this);
      const svArgValue = nullthrows(svArg.value);
      const { options } = this;

      const word = getData(
        svArgValue === GENDER_ANY
          ? GenderConstEnum.UNKNOWN_PLURAL
          : (svArgValue as GenderConstEnum),
        options.type
      );
      invariant(
        typeof word === 'string',
        'Expected pronoun word to be a string but we got %s',
        varDump(word)
      );

      return options.capitalize
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word;
    } catch (error: any) {
      throw errorAt(this.node, error);
    }
  }

  override getArgsForStringVariationCalc(): ReadonlyArray<GenderStringVariationArg> {
    const { options } = this;
    const candidates = new Set<GenderConstEnum | '*'>();

    for (const gender of candidatePronounGenders) {
      if (options.human === true && gender === GenderConstEnum.NOT_A_PERSON) {
        continue;
      }
      const resolvedGender = getPronounGenderKey(options.type, gender);
      candidates.add(
        resolvedGender === GenderConstEnum.UNKNOWN_PLURAL
          ? GENDER_ANY
          : resolvedGender
      );
    }

    return [
      new GenderStringVariationArg(
        this,
        options.gender,
        Array.from(candidates)
      ),
    ];
  }

  override getFbtRuntimeArg(): CallExpression {
    const { gender, human, type } = this.options;
    const numericUsageExpr = numericLiteral(ValidPronounUsages[type]);

    const pronounArgs = [numericUsageExpr, gender];
    if (human) {
      pronounArgs.push(
        objectExpression([
          objectProperty(identifier(HUMAN_OPTION), numericLiteral(1)),
        ])
      );
    }

    return createFbtRuntimeArgCallExpression(this, pronounArgs);
  }

  override getArgsThatShouldNotContainFunctionCallOrClassInstantiation(): Readonly<{
    [argName: string]: CallExpressionArg;
  }> {
    return { gender: this.options.gender };
  }
}

function getPronounGenderKey(
  usage: ValidPronounUsagesKey,
  gender: GenderConstEnum
): GenderConstEnum {
  switch (gender) {
    case GenderConstEnum.NOT_A_PERSON:
      return usage === ValidPronounUsagesKeys.object ||
        usage === ValidPronounUsagesKeys.reflexive
        ? GenderConstEnum.NOT_A_PERSON
        : GenderConstEnum.UNKNOWN_PLURAL;

    case GenderConstEnum.FEMALE_SINGULAR:
    case GenderConstEnum.FEMALE_SINGULAR_GUESS:
      return GenderConstEnum.FEMALE_SINGULAR;

    case GenderConstEnum.MALE_SINGULAR:
    case GenderConstEnum.MALE_SINGULAR_GUESS:
      return GenderConstEnum.MALE_SINGULAR;

    case GenderConstEnum.MIXED_UNKNOWN:
    case GenderConstEnum.FEMALE_PLURAL:
    case GenderConstEnum.MALE_PLURAL:
    case GenderConstEnum.NEUTER_PLURAL:
    case GenderConstEnum.UNKNOWN_PLURAL:
      return GenderConstEnum.UNKNOWN_PLURAL;

    case GenderConstEnum.NEUTER_SINGULAR:
    case GenderConstEnum.UNKNOWN_SINGULAR:
      return usage === ValidPronounUsagesKeys.reflexive
        ? GenderConstEnum.NOT_A_PERSON
        : GenderConstEnum.UNKNOWN_PLURAL;
  }

  invariant(false, 'Unknown GENDER_CONST value: %s', varDump(gender));
}

// Prepare the list of genders actually used by the pronoun construct
function consolidatedPronounGenders(): ReadonlyArray<GenderConstEnum> {
  const set = new Set<GenderConstEnum>();

  for (const gender of Genders) {
    for (const usageKey of Object.keys(ValidPronounUsagesKeys)) {
      set.add(
        getPronounGenderKey(
          ValidPronounUsagesKeys[
            usageKey as keyof typeof ValidPronounUsagesKeys
          ],
          gender
        )
      );
    }
  }

  return [...set].sort((a, b) => a - b);
}
