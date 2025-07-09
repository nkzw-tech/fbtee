import {
  CallExpression,
  isCallExpression,
  isStringLiteral,
  Node,
  stringLiteral,
} from '@babel/types';
import invariant from 'invariant';
import {
  BindingName,
  PLURAL_PARAM_TOKEN,
  ShowCountKeys,
  ValidPluralOptions,
} from '../FbtConstants.tsx';
import FbtNodeChecker from '../FbtNodeChecker.tsx';
import type { CallExpressionArg } from '../FbtUtil.tsx';
import {
  collectOptionsFromFbtConstruct,
  createRuntimeCallExpression,
  enforceNodeCallExpressionArg,
  enforceString,
  enforceStringEnum,
  errorAt,
  varDump,
} from '../FbtUtil.tsx';
import nullthrows from '../nullthrows.tsx';
import {
  EXACTLY_ONE,
  NUMBER_ANY,
  IntlNumberVariations,
  IntlVariations,
} from '../translate/IntlVariations.tsx';
import type { StringVariationArgsMap } from './FbtArguments.tsx';
import { NumberStringVariationArg } from './FbtArguments.tsx';
import FbtNode from './FbtNode.tsx';
import { tokenNameToTextPattern } from './FbtNodeUtil.tsx';

type Options = {
  // Represents the number used for determining the plural case at runtime
  count: CallExpressionArg;
  few?: string | null; // text to show when count is few (e.g., 2-4 in Russian)
  many?: string | null; // text to show when count > 1 (existing behavior)
  name: string | null; // token name,
  // If `yes`, show the `count` number as a prefix of the current plural text
  // If `ifMany`, behaves as `yes` when the count value is greater than 1
  // Else, `no` to hide the `count` number
  showCount: keyof typeof ShowCountKeys;
  two?: string | null; // text to show when count is two (e.g., exactly 2 in Arabic)
  value?: CallExpressionArg | null; // optional value to replace token (rather than count)
  zero?: string | null; // text to show when count is zero (e.g., 0 in Arabic)
};

/**
 * Represents an <fbt:plural> or fbt.plural() construct.
 * @see docs/plurals.md
 */
export default class FbtPluralNode extends FbtNode<
  NumberStringVariationArg,
  CallExpression,
  null,
  Options
> {
  static readonly type = 'plural';
  readonly type = 'plural';

  static fromNode(moduleName: BindingName, node: Node): FbtPluralNode | null {
    if (!isCallExpression(node)) {
      return null;
    }

    const constructName =
      FbtNodeChecker.forModule(moduleName).getFbtNodeType(node);
    return constructName === 'plural'
      ? new FbtPluralNode({
          moduleName,
          node,
        })
      : null;
  }

  override getOptions(): Options {
    const rawOptions = collectOptionsFromFbtConstruct(
      this.moduleName,
      this.node,
      ValidPluralOptions,
    );

    try {
      const [, countArg] = this.getCallNodeArguments() || [];
      const count = enforceNodeCallExpressionArg(
        countArg,
        '`count`, the second function argument',
      );
      const showCount =
        (typeof rawOptions.showCount === 'string' &&
          enforceStringEnum.orNull(
            rawOptions.showCount,
            ValidPluralOptions.showCount,
            '`showCount` option',
          )) ||
        ShowCountKeys.no;
      const name =
        enforceString.orNull(rawOptions.name, '`name` option') ||
        (showCount !== ShowCountKeys.no ? PLURAL_PARAM_TOKEN : null);
      return {
        count,
        few: enforceString.orNull(rawOptions.few, '`few` option'),
        many: enforceString.orNull(rawOptions.many, '`many` option'),
        name,
        showCount,
        two: enforceString.orNull(rawOptions.two, '`two` option'),
        value:
          rawOptions.value != null &&
          typeof rawOptions.value !== 'string' &&
          typeof rawOptions.value !== 'boolean'
            ? enforceNodeCallExpressionArg.orNull(
                rawOptions.value,
                '`value` option',
              )
            : null,
        zero: enforceString.orNull(rawOptions.zero, '`zero` option'),
      };
    } catch (error) {
      throw errorAt(this.node, error);
    }
  }

  _branchByNumberVariation<T>(
    argsMap: StringVariationArgsMap,
    scenario: {
      anyNumber: () => T;
      exactlyOne: () => T;
      few?: () => T;
      two?: () => T;
      zero?: () => T;
    },
  ): T {
    const svArg = argsMap.get(this);
    const svArgValue = nullthrows(svArg.value);

    switch (svArgValue) {
      case EXACTLY_ONE: {
        return scenario.exactlyOne();
      }
      case IntlNumberVariations.ZERO: {
        return scenario.zero ? scenario.zero() : scenario.anyNumber();
      }
      case IntlNumberVariations.TWO: {
        return scenario.two ? scenario.two() : scenario.anyNumber();
      }
      case IntlNumberVariations.FEW: {
        return scenario.few ? scenario.few() : scenario.anyNumber();
      }
      case NUMBER_ANY: {
        return scenario.anyNumber();
      }
      default:
        invariant(
          false,
          'Unsupported string variation value: %s',
          varDump(svArgValue),
        );
    }
  }

  _getStaticTokenName(): string {
    return nullthrows(this.options.name);
  }

  override getTokenName(argsMap: StringVariationArgsMap): string | null {
    return this._branchByNumberVariation(argsMap, {
      anyNumber: () => {
        return this.options.showCount !== ShowCountKeys.no
          ? this._getStaticTokenName()
          : null;
      },
      exactlyOne: () => null,
      few: () => null,
      two: () => null,
      zero: () => null,
    });
  }

  override getText(argsMap: StringVariationArgsMap): string {
    try {
      const { showCount } = this.options;
      const anyNumber = () => {
        const many = this.options.many ?? this._getSingularText() + 's';
        return (
          (showCount !== ShowCountKeys.no
            ? tokenNameToTextPattern(this._getStaticTokenName()) + ' '
            : '') + many
        );
      };

      return this._branchByNumberVariation(argsMap, {
        anyNumber,
        exactlyOne: () =>
          (showCount === ShowCountKeys.yes ? '1 ' : '') +
          this._getSingularText(),
        few: () => this.options.few ?? anyNumber(),
        two: () => this.options.two ?? anyNumber(),
        zero: () => this.options.zero ?? anyNumber(),
      });
    } catch (error) {
      throw errorAt(this.node, error);
    }
  }

  _getSingularText(): string {
    const callArg0 = nullthrows((this.getCallNodeArguments() || [])[0]);
    invariant(
      isStringLiteral(callArg0),
      'Expected a StringLiteral but got "%s" instead',
      callArg0.type,
    );
    return callArg0.value;
  }

  override getArgsForStringVariationCalc(): ReadonlyArray<NumberStringVariationArg> {
    const candidateValues: Array<
      typeof NUMBER_ANY | typeof EXACTLY_ONE | IntlVariations
    > = [NUMBER_ANY];

    if (this.options.zero != null) {
      candidateValues.push(IntlNumberVariations.ZERO);
    }
    if (this.options.two != null) {
      candidateValues.push(IntlNumberVariations.TWO);
    }
    if (this.options.few != null) {
      candidateValues.push(IntlNumberVariations.FEW);
    }

    candidateValues.push(EXACTLY_ONE);

    return [
      new NumberStringVariationArg(this, this.options.count, candidateValues),
    ];
  }

  override getFbtRuntimeArg(): CallExpression {
    const { count, name, showCount, value } = this.options;

    const pluralArgs = [count];
    if (showCount !== ShowCountKeys.no) {
      invariant(
        name != null,
        'name must be defined when showCount=%s',
        showCount,
      );
      pluralArgs.push(stringLiteral(name));
      if (value) {
        pluralArgs.push(value);
      }
    }
    return createRuntimeCallExpression(this, pluralArgs);
  }

  override getArgsThatShouldNotContainFunctionCallOrClassInstantiation(): Readonly<{
    [argName: string]: CallExpressionArg;
  }> {
    return { count: this.options.count };
  }
}
