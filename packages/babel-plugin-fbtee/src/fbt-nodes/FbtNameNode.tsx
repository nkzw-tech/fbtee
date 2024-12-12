import {
  CallExpression,
  isCallExpression,
  isStringLiteral,
  Node,
  stringLiteral,
} from '@babel/types';
import invariant from 'invariant';
import { BindingName } from '../FbtConstants.tsx';
import FbtNodeChecker from '../FbtNodeChecker.tsx';
import type { CallExpressionArg } from '../FbtUtil.tsx';
import {
  createRuntimeCallExpression,
  enforceNodeCallExpressionArg,
  errorAt,
} from '../FbtUtil.tsx';
import { GENDER_ANY } from '../translate/IntlVariations.tsx';
import type { StringVariationArgsMap } from './FbtArguments.tsx';
import { GenderStringVariationArg } from './FbtArguments.tsx';
import FbtNode from './FbtNode.tsx';
import { tokenNameToTextPattern } from './FbtNodeUtil.tsx';

type Options = {
  // `Node` representing the `gender` of the fbt:name's value
  gender: CallExpressionArg;
  name: string; // Name of the string token,
  // `Node` representing the `value` of the fbt:name to render on the UI
  value: CallExpressionArg;
};

/**
 * Represents an <fbt:name> or fbt.name() construct.
 * @see docs/params.md
 */
export default class FbtNameNode extends FbtNode<
  GenderStringVariationArg,
  CallExpression,
  null,
  Options
> {
  static readonly type = 'name';
  readonly type = 'name';

  override getOptions(): Options {
    try {
      const { moduleName } = this;
      const [node, initialValue, initialGender] =
        this.getCallNodeArguments() || [];

      invariant(
        isStringLiteral(node),
        'Expected first argument of %s.name to be a string literal, but got %s',
        moduleName,
        node && node.type,
      );
      const value = enforceNodeCallExpressionArg(
        initialValue,
        `Second argument of ${moduleName}.name`,
      );
      const gender = enforceNodeCallExpressionArg(
        initialGender,
        `Third argument of ${moduleName}.name`,
      );

      return { gender, name: node.value, value };
    } catch (error) {
      throw errorAt(this.node, error);
    }
  }

  static fromNode(moduleName: BindingName, node: Node): FbtNameNode | null {
    if (!isCallExpression(node)) {
      return null;
    }

    const constructName =
      FbtNodeChecker.forModule(moduleName).getFbtNodeType(node);
    return constructName === 'name'
      ? new FbtNameNode({
          moduleName,
          node,
        })
      : null;
  }

  override getArgsForStringVariationCalc(): ReadonlyArray<GenderStringVariationArg> {
    return [
      new GenderStringVariationArg(this, this.options.gender, [GENDER_ANY]),
    ];
  }

  override getTokenName(_argsMap: StringVariationArgsMap): string {
    return this.options.name;
  }

  override getText(argsMap: StringVariationArgsMap): string {
    try {
      argsMap.get(this);
      return tokenNameToTextPattern(this.options.name);
    } catch (error) {
      throw errorAt(this.node, error);
    }
  }

  override getFbtRuntimeArg(): CallExpression {
    const { gender, name, value } = this.options;
    return createRuntimeCallExpression(
      this,
      [stringLiteral(name), value, gender].filter(Boolean),
    );
  }

  override getArgsThatShouldNotContainFunctionCallOrClassInstantiation(): Readonly<{
    [argName: string]: CallExpressionArg;
  }> {
    return { gender: this.options.gender };
  }
}
