import {
  CallExpression,
  identifier,
  isCallExpression,
  isStringLiteral,
  Node,
  numericLiteral,
  objectExpression,
  objectProperty,
} from '@babel/types';
import invariant from 'invariant';
import type { BindingName, ValidPronounUsagesKey } from '../FbtConstants.tsx';
import {
  ValidPronounOptions,
  ValidPronounUsages,
  ValidPronounUsagesKeys,
} from '../FbtConstants.tsx';
import FbtNodeChecker from '../FbtNodeChecker.tsx';
import type { CallExpressionArg } from '../FbtUtil.tsx';
import {
  collectOptionsFromFbtConstruct,
  createRuntimeCallExpression,
  enforceBoolean,
  enforceNodeCallExpressionArg,
  enforceStringEnum,
  errorAt,
  varDump,
} from '../FbtUtil.tsx';
import { GenderConst, Genders, getData } from '../Gender.tsx';
import nullthrows from '../nullthrows.tsx';
import { GENDER_ANY } from '../translate/IntlVariations.tsx';
import type { StringVariationArgsMap } from './FbtArguments.tsx';
import { GenderStringVariationArg } from './FbtArguments.tsx';
import FbtNode from './FbtNode.tsx';

type Options = {
  // If true, capitalize the pronoun text
  capitalize?: boolean | null;
  // CallExpressionArg representing the value of the `gender`
  gender: CallExpressionArg;
  // If true, exclude non-human-related pronouns from the generated string variations
  human?: boolean | null;
  // Type of pronoun
  type: ValidPronounUsagesKey;
};

const candidatePronounGenders: ReadonlyArray<GenderConst> =
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
  static readonly type = 'pronoun';
  readonly type = 'pronoun';

  static fromNode(moduleName: BindingName, node: Node): FbtPronounNode | null {
    if (!isCallExpression(node)) {
      return null;
    }
    const constructName =
      FbtNodeChecker.forModule(moduleName).getFbtNodeType(node);
    return constructName === 'pronoun'
      ? new FbtPronounNode({
          moduleName,
          node,
        })
      : null;
  }

  constructor({
    moduleName,
    node,
  }: {
    moduleName: BindingName;
    node: CallExpression;
  }) {
    super({ moduleName, node });

    const args = this.getCallNodeArguments();
    invariant(
      (args && (args.length === 2 || args.length === 3)) || !args,
      "Expected '(usage, gender [, options])' arguments to %s.pronoun()",
      this.moduleName,
    );
  }

  override getOptions(): Options {
    const { moduleName } = this;
    const rawOptions = collectOptionsFromFbtConstruct(
      moduleName,
      this.node,
      ValidPronounOptions,
    );

    try {
      const args = this.getCallNodeArguments() || [];
      const [usageArg, genderArg] = args;
      invariant(
        isStringLiteral(usageArg),
        '`usage`, the first argument of %s.pronoun() must be a `StringLiteral` but we got `%s`',
        moduleName,
        usageArg?.type || 'unknown',
      );
      const type = enforceStringEnum(
        usageArg.value,
        ValidPronounUsages,
        `\`usage\`, the first argument of ${moduleName}.pronoun()`,
      );
      const gender = enforceNodeCallExpressionArg(
        genderArg,
        '`gender`, the second argument',
      );
      const mergedOptions = nullthrows(rawOptions);
      return {
        capitalize: enforceBoolean.orNull(mergedOptions.capitalize),
        gender,
        human: enforceBoolean.orNull(mergedOptions.human),
        type,
      };
    } catch (error) {
      throw errorAt(this.node, error);
    }
  }

  override getText(argsMap: StringVariationArgsMap): string {
    try {
      const svArg = argsMap.get(this);
      const svArgValue = nullthrows(svArg.value);
      const { options } = this;

      const word = getData(
        svArgValue === GENDER_ANY
          ? GenderConst.UNKNOWN_PLURAL
          : (svArgValue as GenderConst),
        options.type,
      );
      invariant(
        typeof word === 'string',
        'Expected pronoun word to be a string but we got %s',
        varDump(word),
      );

      return options.capitalize
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word;
    } catch (error) {
      throw errorAt(this.node, error);
    }
  }

  override getArgsForStringVariationCalc(): ReadonlyArray<GenderStringVariationArg> {
    const { options } = this;
    const candidates = new Set<GenderConst | '*'>();

    for (const gender of candidatePronounGenders) {
      if (options.human === true && gender === GenderConst.NOT_A_PERSON) {
        continue;
      }
      const resolvedGender = getPronounGenderKey(options.type, gender);
      candidates.add(
        resolvedGender === GenderConst.UNKNOWN_PLURAL
          ? GENDER_ANY
          : resolvedGender,
      );
    }

    return [
      new GenderStringVariationArg(
        this,
        options.gender,
        Array.from(candidates),
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
        ]),
      );
    }

    return createRuntimeCallExpression(this, pronounArgs);
  }

  override getArgsThatShouldNotContainFunctionCallOrClassInstantiation(): Readonly<{
    [argName: string]: CallExpressionArg;
  }> {
    return { gender: this.options.gender };
  }
}

function getPronounGenderKey(
  usage: ValidPronounUsagesKey,
  gender: GenderConst,
): GenderConst {
  switch (gender) {
    case GenderConst.NOT_A_PERSON:
      return usage === ValidPronounUsagesKeys.object ||
        usage === ValidPronounUsagesKeys.reflexive
        ? GenderConst.NOT_A_PERSON
        : GenderConst.UNKNOWN_PLURAL;

    case GenderConst.FEMALE_SINGULAR:
      return GenderConst.FEMALE_SINGULAR;

    case GenderConst.MALE_SINGULAR:
      return GenderConst.MALE_SINGULAR;

    case GenderConst.UNKNOWN_PLURAL:
      return GenderConst.UNKNOWN_PLURAL;

    case GenderConst.UNKNOWN_SINGULAR:
      return usage === ValidPronounUsagesKeys.reflexive
        ? GenderConst.NOT_A_PERSON
        : GenderConst.UNKNOWN_PLURAL;
  }

  invariant(false, 'Unknown GENDER_CONST value: %s', varDump(gender));
}

// Prepare the list of genders actually used by the pronoun construct
function consolidatedPronounGenders(): ReadonlyArray<GenderConst> {
  const set = new Set<GenderConst>();

  for (const gender of Genders) {
    for (const usageKey of Object.keys(ValidPronounUsagesKeys)) {
      set.add(
        getPronounGenderKey(
          ValidPronounUsagesKeys[
            usageKey as keyof typeof ValidPronounUsagesKeys
          ],
          gender,
        ),
      );
    }
  }

  return [...set].sort((a, b) => a - b);
}
