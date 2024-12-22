import {
  isBinaryExpression,
  isJSXAttribute,
  isJSXElement,
  isJSXExpressionContainer,
  isJSXIdentifier,
  isNumericLiteral,
  isStringLiteral,
  isTemplateLiteral,
  JSXElement,
  JSXText,
  Node,
  ObjectExpression,
} from '@babel/types';
import invariant from 'invariant';
import { BindingName } from '../FbtConstants.tsx';
import type { ParamSet } from '../FbtUtil.tsx';
import {
  convertToStringArrayNodeIfNeeded,
  errorAt,
  setUniqueToken,
  varDump,
} from '../FbtUtil.tsx';
import type { TokenAliases } from '../index.tsx';
import nullthrows from '../nullthrows.tsx';
import type {
  AnyStringVariationArg,
  StringVariationArgsMap,
} from './FbtArguments.tsx';
import type { IFbtElementNode } from './FbtElementNode.tsx';
import FbtElementNode from './FbtElementNode.tsx';
import type { AnyFbtNode, FbtChildNode, PlainFbtNode } from './FbtNode.tsx';
import FbtNode from './FbtNode.tsx';
import {
  convertIndexInSiblingsArrayToOuterTokenAlias,
  convertToTokenName,
  getChildNodeText,
  getChildNodeTextForDescription,
  getTextFromFbtNodeTree,
  getTokenAliasesFromFbtNodeTree,
} from './FbtNodeUtil.tsx';
import FbtTextNode from './FbtTextNode.tsx';

/**
 * Represents non-fbt JSX element nested inside an fbt callsite.
 */
export default class FbtImplicitParamNode
  extends FbtNode<AnyStringVariationArg, JSXElement, FbtChildNode, null>
  implements IFbtElementNode
{
  readonly type = 'implicitParam';

  _tokenSet: ParamSet = {};

  _getElementNode(): FbtElementNode {
    return nullthrows(this.getFirstAncestorOfType(FbtElementNode));
  }

  _getSubjectNode(): Node | null | undefined {
    return this._getElementNode().options.subject;
  }

  override getOptions(): null {
    return null;
  }

  /**
   * We define an FbtImplicitParamNode's outer token alias to be
   * string concatenation of '=m' + the FbtImplicitParamNode's index in its siblings array.
   *
   * @example For string <fbt> hello <a>world</a></fbt>,
   *          the outer token alias of <a>world</a> will be '=m1'.
   */
  getOuterTokenAlias(): string {
    const index = nullthrows(
      this.parent,
      'Parent node must be defined',
    ).children.indexOf(this);
    invariant(
      index != -1,
      "Could not find current fbt node among the parent node's children",
    );
    return convertIndexInSiblingsArrayToOuterTokenAlias(index);
  }

  override getArgsForStringVariationCalc(): ReadonlyArray<AnyStringVariationArg> {
    return FbtElementNode.getArgsForStringVariationCalcForFbtElement(
      this,
      // The implicit fbt string may depend on a subject, inferred from the top-level FbtElementNode
      this._getSubjectNode(),
    );
  }

  override getText(argsMap: StringVariationArgsMap): string {
    try {
      FbtElementNode.beforeGetTextCheck(this, argsMap);
      return getTextFromFbtNodeTree(
        this,
        argsMap,
        this._getSubjectNode(),
        this._getElementNode().options.preserveWhitespace,
        getChildNodeText,
      );
    } catch (error) {
      throw errorAt(this.node, error);
    }
  }

  getTextForDescription(
    argsMap: StringVariationArgsMap,
    targetFbtNode: FbtImplicitParamNode,
  ): string {
    return getTextFromFbtNodeTree(
      this,
      argsMap,
      this._getSubjectNode(),
      this._getElementNode().options.preserveWhitespace,
      getChildNodeTextForDescription.bind(null, targetFbtNode),
    );
  }

  /**
   * Returns the text of this FbtNode in a "token name" format.
   * Note: it's prefixed by `=` to differentiate normal token names from implicit param nodes.
   *
   * E.g. `=Hello [name]`
   */
  override getTokenName(argsMap: StringVariationArgsMap): string {
    return convertToTokenName(
      getTextFromFbtNodeTree(
        this,
        argsMap,
        this._getSubjectNode(),
        this._getElementNode().options.preserveWhitespace,
        (_, child) => child.getText(argsMap),
      ),
    );
  }

  /**
   * Returns the string description which depends on the string variation factor values
   * from the whole fbt callsite.
   */
  getDescription(argsMap: StringVariationArgsMap): string {
    return `In the phrase: "${this._getElementNode().getTextForDescription(
      argsMap,
      this,
    )}"`;
  }

  override getTokenAliases(
    argsMap: StringVariationArgsMap,
  ): TokenAliases | null {
    return getTokenAliasesFromFbtNodeTree(this, argsMap);
  }

  /**
   * Returns whether this implicit param node is an ancestor of a given `node`
   */
  isAncestorOf(node: AnyFbtNode): boolean {
    for (let { parent } = node; parent != null; parent = parent.parent) {
      if (parent === this) {
        return true;
      }
    }
    return false;
  }

  /**
   * The fbt._() call generated from an inner string surrounded by JSX tags would
   * inherit extra options specified on its ancestor fbt callsite. Consider this
   * example:
   *
   * <fbt desc='d' myOption='yes'>
   *  This is
   *  <b>
   *    an inner string and
   *    <b>
   *      another inner string
   *    </b>
   *  </b>
   * </fbt>
   *
   * We would generate `fbt._('another inner string', null, {eo: {myOption: 'yes'}})`
   * for the innermost string.
   */
  getExtraOptionsNode(): ObjectExpression | null | undefined {
    const ancestorFbtElementNode = this.getFirstAncestorOfType(FbtElementNode);
    invariant(
      ancestorFbtElementNode != null,
      'Expect every `FbtImplicitParamNode` to have a `FbtElementNode` ancestor ' +
        'but could not find one for %s',
      varDump(this),
    );
    return ancestorFbtElementNode.getExtraOptionsNode();
  }

  /**
   * Create a new class instance given a root node.
   * If that node is incompatible, we'll just return `null`.
   */
  static fromNode(
    moduleName: BindingName,
    node: Node,
  ): FbtImplicitParamNode | null {
    if (!isJSXElement(node)) {
      return null;
    }
    const implicitParam = new FbtImplicitParamNode({
      moduleName,
      node,
    });

    const fbtChildren: Array<FbtChildNode | null> = [];
    // The last node child converted to FbtChildNode and added to `fbtChildren`
    let lastAddedChild = null;
    // Keep track of the last whitespace that succeeds a non JSXText child,
    // and we will convert it to a FbtTextNode and add it to `fbtChildren`
    // ONLY IF the succeeding child is a JSXText.
    let unusedWhitespaceChild: JSXText | null = null;
    const firstChild = node.children[0];
    const lastChild = node.children.at(-1);
    for (const child of node.children) {
      switch (child.type) {
        case 'JSXText':
          // TODO: Fix space normalization.
          // Here we voluntarily ignore white spaces that don't neighbor raw text
          // for the sake of being consistent with the logic in PHP
          if (child.value.trim() === '') {
            if (
              // Do not skip leading and trailing whitespaces
              firstChild !== child &&
              lastChild !== child &&
              lastAddedChild?.type !== 'JSXText'
            ) {
              unusedWhitespaceChild = child;
              break;
            }
          } else if (unusedWhitespaceChild != null) {
            fbtChildren.push(
              FbtTextNode.fromNode(moduleName, unusedWhitespaceChild),
            );
            unusedWhitespaceChild = null;
          }
          fbtChildren.push(FbtTextNode.fromNode(moduleName, child));
          lastAddedChild = child;
          break;

        case 'JSXExpressionContainer': {
          const { expression } = child;
          if (
            isBinaryExpression(expression) ||
            isStringLiteral(expression) ||
            isTemplateLiteral(expression)
          ) {
            const elements =
              convertToStringArrayNodeIfNeeded(moduleName, expression)
                .elements || ([] as Array<null>);

            for (const element of elements) {
              if (element == null) {
                continue;
              }
              if (element.type !== 'StringLiteral') {
                throw errorAt(
                  child,
                  `${moduleName}: only string literals (or concatenations of string literals) ` +
                    `are supported inside JSX expressions, ` +
                    `but we found the node type "${element.type}" instead.`,
                );
              }
              fbtChildren.push(
                FbtElementNode.createChildNode(moduleName, element),
              );
            }
            unusedWhitespaceChild = null;
            lastAddedChild = child;
            continue;
          }

          if (expression.type === 'JSXEmptyExpression') {
            // usually, it's a comment inside a JSX expression
            continue;
          }

          fbtChildren.push(
            FbtElementNode.createChildNode(moduleName, expression),
          );
          unusedWhitespaceChild = null;
          lastAddedChild = child;
          break;
        }

        case 'JSXElement': {
          fbtChildren.push(FbtElementNode.createChildNode(moduleName, child));
          unusedWhitespaceChild = null;
          lastAddedChild = child;
          break;
        }

        default:
          throw errorAt(
            child,
            `${moduleName}: unsupported node: ${child.type}`,
          );
      }
    }

    fbtChildren.forEach((child) => implicitParam.appendChild(child));
    return implicitParam;
  }

  registerToken(name: string, source: AnyFbtNode) {
    setUniqueToken(source.node, this.moduleName, name, this._tokenSet);
  }

  override toJSON() {
    return FbtElementNode.__compactTokenSet(
      super.toJSON() as Record<string, unknown>,
    );
  }

  override toPlainFbtNode(): PlainFbtNode {
    const {
      node: { openingElement },
    } = this;
    const wrapperType = openingElement.name;
    invariant(
      isJSXIdentifier(wrapperType),
      'Expected a JSXIdentifier instead of `%s`',
      varDump(wrapperType),
    );

    const props: {
      [key: string]: string | number;
    } = {};
    for (const attribute of openingElement.attributes) {
      if (isJSXAttribute(attribute) && isJSXIdentifier(attribute.name)) {
        const { name, value } = attribute;
        if (isStringLiteral(value)) {
          props[name.name] = value.value;
        } else if (
          isJSXExpressionContainer(value) &&
          isNumericLiteral(value.expression)
        ) {
          props[name.name] = value.expression.value;
        }
      }
    }

    return {
      type: 'implicitParam',
      wrapperNode: {
        node: openingElement,
        props,
        type: wrapperType.name,
      },
    };
  }
}
