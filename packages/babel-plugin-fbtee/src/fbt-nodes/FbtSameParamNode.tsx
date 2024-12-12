import {
  CallExpression,
  Expression,
  isCallExpression,
  isStringLiteral,
} from '@babel/types';
import invariant from 'invariant';
import { BindingName } from '../FbtConstants.tsx';
import FbtNodeChecker from '../FbtNodeChecker.tsx';
import { errorAt } from '../FbtUtil.tsx';
import type { StringVariationArgsMap } from './FbtArguments.tsx';
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
  readonly type = 'sameParam';

  static fromNode({
    moduleName,
    node,
  }: {
    moduleName: BindingName;
    node: Expression;
  }): FbtSameParamNode | null {
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

  override getTokenName(_argsMap: StringVariationArgsMap): string {
    return this.options.name;
  }

  override getText(_argsList: StringVariationArgsMap): string {
    try {
      return tokenNameToTextPattern(this.getTokenName(_argsList));
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
