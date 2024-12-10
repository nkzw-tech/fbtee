import {
  CallExpression,
  Expression,
  isCallExpression,
  isStringLiteral,
  stringLiteral,
} from '@babel/types';
import invariant from 'invariant';
import {
  JSModuleNameType,
  PLURAL_PARAM_TOKEN,
  ShowCountKeys,
  ValidPluralOptions,
} from '../FbtConstants.tsx';
import FbtNodeChecker from '../FbtNodeChecker.tsx';
import type { CallExpressionArg } from '../FbtUtil.tsx';
import {
  collectOptionsFromFbtConstruct,
  createFbtRuntimeArgCallExpression,
  enforceBabelNodeCallExpressionArg,
  enforceString,
  enforceStringEnum,
  errorAt,
  varDump,
} from '../FbtUtil.tsx';
import nullthrows from '../nullthrows.tsx';
import { EXACTLY_ONE, NUMBER_ANY } from '../translate/IntlVariations.tsx';
import type { StringVariationArgsMap } from './FbtArguments.tsx';
import { NumberStringVariationArg } from './FbtArguments.tsx';
import FbtNode from './FbtNode.tsx';
import { FbtNodeType } from './FbtNodeType.tsx';
import { tokenNameToTextPattern } from './FbtNodeUtil.tsx';

type Options = {
  // Represents the number used for determining the plural case at runtime
  count: CallExpressionArg;
  many?: string | null; // text to show when count>1,
  name: string | null; // token name,
  // If `yes`, show the `count` number as a prefix of the current plural text
  // If `ifMany`, behaves as `yes` when the count value is greater than 1
  // Else, `no` to hide the `count` number
  showCount: keyof typeof ShowCountKeys;
  value?: CallExpressionArg | null; // optional value to replace token (rather than count)
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
  static readonly type: FbtNodeType = 'plural';

  static fromBabelNode({
    moduleName,
    node,
  }: {
    moduleName: JSModuleNameType;
    node: Expression;
  }): FbtPluralNode | null {
    if (!isCallExpression(node)) {
      return null;
    }

    const checker = FbtNodeChecker.forModule(moduleName);
    const constructName = checker.getFbtConstructNameFromFunctionCall(node);
    return constructName === FbtPluralNode.type
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
      ValidPluralOptions
    );

    try {
      const [_, countArg] = this.getCallNodeArguments() || [];
      const count = enforceBabelNodeCallExpressionArg(
        countArg,
        '`count`, the second function argument'
      );
      const showCount =
        (typeof rawOptions.showCount === 'string' &&
          enforceStringEnum.orNull(
            rawOptions.showCount,
            ValidPluralOptions.showCount,
            '`showCount` option'
          )) ||
        ShowCountKeys.no;
      const name =
        enforceString.orNull(rawOptions.name, '`name` option') ||
        (showCount !== ShowCountKeys.no ? PLURAL_PARAM_TOKEN : null);
      return {
        count,
        many: enforceString.orNull(rawOptions.many, '`many` option'),
        name,
        showCount,
        value:
          rawOptions.value != null &&
          typeof rawOptions.value !== 'string' &&
          typeof rawOptions.value !== 'boolean'
            ? enforceBabelNodeCallExpressionArg.orNull(
                rawOptions.value,
                '`value` option'
              )
            : null,
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
    }
  ): T {
    const svArg = argsMap.get(this);
    const svArgValue = nullthrows(svArg.value);

    switch (svArgValue) {
      case EXACTLY_ONE: {
        return scenario.exactlyOne();
      }
      case NUMBER_ANY: {
        return scenario.anyNumber();
      }
      default:
        invariant(
          false,
          'Unsupported string variation value: %s',
          varDump(svArgValue)
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
    });
  }

  override getText(argsMap: StringVariationArgsMap): string {
    try {
      const { showCount } = this.options;
      return this._branchByNumberVariation(argsMap, {
        anyNumber: () => {
          const many = this.options.many ?? this._getSingularText() + 's';
          return showCount !== ShowCountKeys.no
            ? tokenNameToTextPattern(this._getStaticTokenName()) + ' ' + many
            : many;
        },
        exactlyOne: () =>
          (showCount === ShowCountKeys.yes ? '1 ' : '') +
          this._getSingularText(),
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
      callArg0.type
    );
    return callArg0.value;
  }

  override getArgsForStringVariationCalc(): ReadonlyArray<NumberStringVariationArg> {
    return [
      new NumberStringVariationArg(this, this.options.count, [
        NUMBER_ANY,
        EXACTLY_ONE,
      ]),
    ];
  }

  override getFbtRuntimeArg(): CallExpression {
    const { count, name, showCount, value } = this.options;

    const pluralArgs = [count];
    if (showCount !== ShowCountKeys.no) {
      invariant(
        name != null,
        'name must be defined when showCount=%s',
        showCount
      );
      pluralArgs.push(stringLiteral(name));
      if (value) {
        pluralArgs.push(value);
      }
    }
    return createFbtRuntimeArgCallExpression(this, pluralArgs);
  }

  override getArgsThatShouldNotContainFunctionCallOrClassInstantiation(): Readonly<{
    [argName: string]: CallExpressionArg;
  }> {
    return { count: this.options.count };
  }
}
