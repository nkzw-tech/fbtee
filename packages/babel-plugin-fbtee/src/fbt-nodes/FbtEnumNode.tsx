import {
  CallExpression,
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
import { BindingName, FBT_ENUM_MODULE_SUFFIX } from '../FbtConstants.tsx';
import type { EnumModule } from '../FbtEnumRegistrar.tsx';
import FbtEnumRegistrar from '../FbtEnumRegistrar.tsx';
import FbtNodeChecker from '../FbtNodeChecker.tsx';
import type { CallExpressionArg } from '../FbtUtil.tsx';
import {
  createRuntimeCallExpression,
  enforceNode,
  enforceNodeCallExpressionArg,
  errorAt,
  varDump,
} from '../FbtUtil.tsx';
import nullthrows from '../nullthrows.tsx';
import type { StringVariationArgsMap } from './FbtArguments.tsx';
import { EnumStringVariationArg } from './FbtArguments.tsx';
import FbtNode from './FbtNode.tsx';

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
  static readonly type = 'enum';
  readonly type = 'enum';

  static fromNode(moduleName: BindingName, node: Node): FbtEnumNode | null {
    if (!isCallExpression(node)) {
      return null;
    }

    const constructName =
      FbtNodeChecker.forModule(moduleName).getFbtNodeType(node);
    return constructName === 'enum'
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
      let range: EnumModule = {};
      rangeNode = enforceNode(rangeNode, '`range`');
      if (isArrayExpression(rangeNode)) {
        invariant(
          rangeNode.elements && rangeNode.elements.length,
          `Enum range cannot be empty.`,
        );
        rangeNode.elements.forEach((item) => {
          invariant(
            isStringLiteral(item),
            `Enum values must be string literals.`,
          );
          range[item.value] = item.value;
        });
      } else if (isObjectExpression(rangeNode)) {
        rangeNode.properties.forEach((prop) => {
          invariant(
            isObjectProperty(prop),
            `Enum entries must be plain object properties. Remove methods and spread properties.`,
          );
          const valueNode = prop.value;
          const keyNode = prop.key;
          invariant(
            isStringLiteral(valueNode),
            `Enum values must be string literals.`,
          );
          if (isStringLiteral(keyNode) || isNumericLiteral(keyNode)) {
            range[keyNode.value.toString()] = valueNode.value;
          } else {
            invariant(
              isIdentifier(keyNode) && prop.computed === false,
              `Enum keys must be strings or identifiers. Received '%s'.`,
              keyNode.type,
            );
            range[keyNode.name] = valueNode.value;
          }
        });
        invariant(Object.keys(range).length, `Enum range cannot be empty.`);
      } else {
        invariant(
          isIdentifier(rangeNode),
          `Enum range must be an array, object, or imported enum variable.`,
        );

        const manifest = nullthrows(
          FbtEnumRegistrar.getEnum(rangeNode.name),
          `Enum '${rangeNode.name}' is not registered. Import a '${FBT_ENUM_MODULE_SUFFIX}' module or add it to the enum manifest.`,
        );
        range = manifest;
      }

      return {
        range,
        value: enforceNodeCallExpressionArg(value, '`value`'),
      };
    } catch (error) {
      throw errorAt(this.node, error);
    }
  }

  override getText(argsMap: StringVariationArgsMap): string {
    try {
      const svArg = argsMap.get(this);
      const svArgValue = nullthrows(svArg.value);
      return nullthrows(
        this.options.range[svArgValue],
        `No enum text found for key ${varDump(svArgValue)}.`,
      );
    } catch (error) {
      throw errorAt(this.node, error);
    }
  }

  override getArgsForStringVariationCalc(): ReadonlyArray<EnumStringVariationArg> {
    return [
      new EnumStringVariationArg(
        this,
        this.options.value,
        Object.keys(this.options.range),
      ),
    ];
  }

  override getFbtRuntimeArg(): CallExpression {
    const [, rangeArg] = this.getCallNodeArguments() || [];

    let runtimeRange = null;
    if (isIdentifier(rangeArg)) {
      runtimeRange = rangeArg;
    } else {
      const { range } = this.options;
      runtimeRange = objectExpression(
        Object.keys(range).map((key) =>
          objectProperty(stringLiteral(key), stringLiteral(range[key]!)),
        ),
      );
    }

    return createRuntimeCallExpression(this, [
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
