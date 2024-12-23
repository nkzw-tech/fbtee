import {
  CallExpression,
  isCallExpression,
  isStringLiteral,
  Node,
} from '@babel/types';
import invariant from 'invariant';
import { BindingName } from '../FbtConstants.tsx';
import FbtNodeChecker from '../FbtNodeChecker.tsx';
import { errorAt } from '../FbtUtil.tsx';
import FbtNode from './FbtNode.tsx';
import { tokenNameToTextPattern } from './FbtNodeUtil.tsx';

type Options = {
  name: string; // Name of the string token
};

/**
 * Represents an <fbt:sameParam> or fbt.sameParam() construct.
 * @see docs/params.md
 */
export default class FbtSameParamNode extends FbtNode<
  never,
  CallExpression,
  null,
  Options
> {
  static readonly type = 'sameParam';
  readonly type = 'sameParam';

  static fromNode(
    moduleName: BindingName,
    node: Node,
  ): FbtSameParamNode | null {
    if (!isCallExpression(node)) {
      return null;
    }
    const constructName =
      FbtNodeChecker.forModule(moduleName).getFbtNodeType(node);
    return constructName === 'sameParam'
      ? new FbtSameParamNode({
          moduleName,
          node,
        })
      : null;
  }

  override getOptions(): Options {
    try {
      const [name] = this.getCallNodeArguments() || [];
      invariant(
        isStringLiteral(name),
        'Expected first argument of %s.sameParam to be a string literal, but got `%s`',
        this.moduleName,
        (name && name.type) || 'unknown',
      );
      return { name: name.value };
    } catch (error) {
      throw errorAt(this.node, error);
    }
  }

  override getTokenName(): string {
    return this.options.name;
  }

  override getText(): string {
    try {
      return tokenNameToTextPattern(this.getTokenName());
    } catch (error) {
      throw errorAt(this.node, error);
    }
  }

  override getArgsForStringVariationCalc(): ReadonlyArray<never> {
    return [];
  }

  override getFbtRuntimeArg(): null {
    return null;
  }
}
