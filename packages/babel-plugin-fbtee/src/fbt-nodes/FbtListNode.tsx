import {
  CallExpression,
  isCallExpression,
  isNullLiteral,
  isStringLiteral,
  Node,
  nullLiteral,
} from '@babel/types';
import { BindingName } from '../FbtConstants.tsx';
import FbtNodeChecker from '../FbtNodeChecker.tsx';
import { createRuntimeCallExpression, errorAt } from '../FbtUtil.tsx';
import nullthrows from '../nullthrows.tsx';
import FbtNode from './FbtNode.tsx';
import { tokenNameToTextPattern } from './FbtNodeUtil.tsx';

type Options = {
  name: string | null;
};

export default class FbtListNode extends FbtNode<
  never,
  CallExpression,
  null,
  Options
> {
  static readonly type = 'list';
  readonly type = 'list';

  static fromNode(moduleName: BindingName, node: Node): FbtListNode | null {
    if (!isCallExpression(node)) {
      return null;
    }

    const constructName =
      FbtNodeChecker.forModule(moduleName).getFbtNodeType(node);
    return constructName === 'list'
      ? new FbtListNode({
          moduleName,
          node,
        })
      : null;
  }

  override getArgsForStringVariationCalc(): ReadonlyArray<never> {
    return [];
  }

  override getTokenName(): string {
    return nullthrows(this.options.name);
  }

  override getText(): string {
    try {
      return tokenNameToTextPattern(this.getTokenName());
    } catch (error) {
      throw errorAt(this.node, error);
    }
  }

  override getOptions() {
    const [name] = this.getCallNodeArguments() || [];

    return {
      name: isStringLiteral(name) ? name.value : null,
    };
  }

  override getFbtRuntimeArg(): CallExpression {
    const [name, items, conjunction, delimiter] =
      this.getCallNodeArguments() || [];
    if (!items) {
      throw errorAt(this.node, `'items' attribute for 'fbt:list' is missing.`);
    }

    if (!name) {
      throw errorAt(this.node, `'name' attribute for 'fbt:list' is missing.`);
    }

    const args = [name, items];
    const hasDelimiter = delimiter && !isNullLiteral(delimiter);
    if ((conjunction && !isNullLiteral(conjunction)) || hasDelimiter) {
      args.push(conjunction || nullLiteral());
    }
    if (hasDelimiter) {
      args.push(delimiter);
    }

    return createRuntimeCallExpression(this, args);
  }
}
