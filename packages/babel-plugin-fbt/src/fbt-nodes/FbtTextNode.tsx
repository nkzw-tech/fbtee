import {
  isJSXText,
  isStringLiteral,
  JSXText,
  StringLiteral,
} from '@babel/types';
import type { StringVariationArgsMap } from './FbtArguments.tsx';
import FbtNode from './FbtNode.tsx';
import type { FromNodeArgs } from './FbtNodeUtil.tsx';

/**
 * Represents the text literals present within <fbt> or fbt() callsites.
 *
 * I.e.
 *
 *  fbt(
 *    'Hello', // <-- FbtTextNode
 *    'description',
 *  )
 */
export default class FbtTextNode extends FbtNode<
  never,
  StringLiteral | JSXText,
  null,
  null
> {
  readonly type = 'text';

  /**
   * Create a new class instance given a BabelNode root node.
   * If that node is incompatible, we'll just return `null`.
   */
  static fromNode({ moduleName, node }: FromNodeArgs): FbtTextNode | null {
    return isJSXText(node) || isStringLiteral(node)
      ? new FbtTextNode({
          moduleName,
          node,
        })
      : null;
  }

  override getOptions(): null {
    return null;
  }

  override getArgsForStringVariationCalc(): ReadonlyArray<never> {
    return [];
  }

  override getText(_argsList: StringVariationArgsMap): string {
    return this.node.value;
  }

  override getFbtRuntimeArg(): null {
    return null;
  }
}
