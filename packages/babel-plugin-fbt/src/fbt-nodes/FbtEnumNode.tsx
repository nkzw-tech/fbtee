import {
  CallExpression,
  Expression,
  isArrayExpression,
  isCallExpression,
  isIdentifier,
  isNumericLiteral,
  isObjectExpression,
  isObjectProperty,
  isStringLiteral,
  Node,
  objectExpression,
  objectProperty,
  stringLiteral,
} from '@babel/types';
import invariant from 'invariant';
import { FBT_ENUM_MODULE_SUFFIX, JSModuleNameType } from '../FbtConstants.tsx';
import type { EnumModule } from '../FbtEnumRegistrar.tsx';
import FbtEnumRegistrar from '../FbtEnumRegistrar.tsx';
import FbtNodeChecker from '../FbtNodeChecker.tsx';
import type { CallExpressionArg } from '../FbtUtil.tsx';
import {
  createFbtRuntimeArgCallExpression,
  enforceBabelNode,
  enforceBabelNodeCallExpressionArg,
  errorAt,
  varDump,
} from '../FbtUtil.tsx';
import nullthrows from '../nullthrows.tsx';
import type { StringVariationArgsMap } from './FbtArguments.tsx';
import { EnumStringVariationArg } from './FbtArguments.tsx';
import FbtNode from './FbtNode.tsx';
import { FbtNodeType } from './FbtNodeType.tsx';

type Options = {
  range: EnumModule; // key/value pairs to use for this fbt:enum,
  // Represents the enum value that'll be used to select
  // the corresponding enum string variation at runtime
  value: CallExpressionArg;
};

/**
 * Represents an <fbt:enum> or fbt.enum() construct.
 * @see docs/enums.md
 */
export default class FbtEnumNode extends FbtNode<
  EnumStringVariationArg,
  CallExpression,
  null,
  Options
> {
  static readonly type: FbtNodeType = FbtNodeType.Enum;

  static fromBabelNode({
    moduleName,
    node,
  }: {
    moduleName: JSModuleNameType;
    node: Expression;
  }): FbtEnumNode | null {
    if (!isCallExpression(node)) {
      return null;
    }

    const checker = FbtNodeChecker.forModule(moduleName);
    const constructName = checker.getFbtConstructNameFromFunctionCall(node);
    return constructName === FbtEnumNode.type
      ? new FbtEnumNode({
          moduleName,
          node,
        })
      : null;
  }

  override getOptions(): Options {
    const [value, rangeArg] = this.getCallNodeArguments() || [];
    let rangeNode: Node | null = rangeArg || null;

    try {
      let range: Record<string, any> = {};
      rangeNode = enforceBabelNode(rangeNode, '`range`');
      if (isArrayExpression(rangeNode)) {
        invariant(
          rangeNode.elements && rangeNode.elements.length,
          'List of enum entries must not be empty'
        );
        rangeNode.elements.forEach((item) => {
          invariant(
            isStringLiteral(item),
            'Enum values must be string literals'
          );
          range[item.value] = item.value;
        });
      } else if (isObjectExpression(rangeNode)) {
        rangeNode.properties.forEach((prop) => {
          invariant(
            isObjectProperty(prop),
            'Enum entries must be standard object properties. ' +
              'Method or spread expressions are forbidden'
          );
          const valueNode = prop.value;
          const keyNode = prop.key;
          invariant(
            isStringLiteral(valueNode),
            'Enum values must be string literals'
          );
          if (isStringLiteral(keyNode) || isNumericLiteral(keyNode)) {
            range[keyNode.value.toString()] = valueNode.value;
          } else {
            invariant(
              isIdentifier(keyNode) && prop.computed === false,
              'Enum keys must be string literals instead of `%s` ' +
                'when using an object with computed property names',
              keyNode.type
            );
            range[keyNode.name] = valueNode.value;
          }
        });
        invariant(
          Object.keys(range).length,
          'Map of enum entries must not be empty'
        );
      } else {
        invariant(
          isIdentifier(rangeNode),
          'Expected enum range (second argument) to be an array, object or ' +
            'a variable referring to an fbt enum'
        );

        const manifest = nullthrows(
          FbtEnumRegistrar.getEnum(rangeNode.name),
          `Fbt Enum \`${rangeNode.name}\` not registered; ensure the enum ` +
            `was correctly imported and that it has the ${FBT_ENUM_MODULE_SUFFIX} suffix.`
        );
        range = manifest;
      }

      return {
        range,
        value: enforceBabelNodeCallExpressionArg(value, '`value`'),
      };
    } catch (error: any) {
      throw errorAt(this.node, error);
    }
  }

  override getText(argsMap: StringVariationArgsMap): string {
    try {
      const svArg = argsMap.get(this);
      const svArgValue = nullthrows(svArg.value);
      return nullthrows(
        this.options.range[svArgValue],
        `Unable to find enum text for key=${varDump(svArgValue)}`
      );
    } catch (error: any) {
      throw errorAt(this.node, error);
    }
  }

  override getArgsForStringVariationCalc(): ReadonlyArray<EnumStringVariationArg> {
    return [
      new EnumStringVariationArg(
        this,
        this.options.value,
        Object.keys(this.options.range)
      ),
    ];
  }

  override getFbtRuntimeArg(): CallExpression {
    const [_, rangeArg] = this.getCallNodeArguments() || [];

    let runtimeRange = null;
    if (isIdentifier(rangeArg)) {
      runtimeRange = rangeArg;
    } else {
      const { range } = this.options;
      runtimeRange = objectExpression(
        Object.keys(range).map((key) =>
          objectProperty(stringLiteral(key), stringLiteral(range[key]!))
        )
      );
    }

    return createFbtRuntimeArgCallExpression(this, [
      this.options.value,
      runtimeRange,
    ]);
  }

  override getArgsThatShouldNotContainFunctionCallOrClassInstantiation(): Readonly<{
    [argName: string]: CallExpressionArg;
  }> {
    return { value: this.options.value };
  }
}
