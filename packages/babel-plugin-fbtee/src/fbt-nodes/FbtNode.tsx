import type { Scope } from '@babel/traverse';
import {
  CallExpression,
  isCallExpression,
  isNewExpression,
  JSXOpeningElement,
  Node,
} from '@babel/types';
import type { BindingName, FbtOptionConfig } from '../FbtConstants.tsx';
import FbtNodeChecker from '../FbtNodeChecker.tsx';
import type { CallExpressionArg, CallExpressionArgument } from '../FbtUtil.tsx';
import { compactNodeProps, errorAt } from '../FbtUtil.tsx';
import type { TokenAliases } from '../index.tsx';
import type {
  AnyStringVariationArg,
  StringVariationArgsMap,
} from './FbtArguments.tsx';
import type FbtEnumNode from './FbtEnumNode.tsx';
import type FbtImplicitParamNode from './FbtImplicitParamNode.tsx';
import type FbtNameNode from './FbtNameNode.tsx';
import { FbtNodeType } from './FbtNodeType.tsx';
import type FbtParamNode from './FbtParamNode.tsx';
import type FbtPluralNode from './FbtPluralNode.tsx';
import type FbtPronounNode from './FbtPronounNode.tsx';
import type FbtSameParamNode from './FbtSameParamNode.tsx';
import type FbtTextNode from './FbtTextNode.tsx';

export type FbtChildNode =
  | FbtEnumNode
  | FbtImplicitParamNode
  | FbtNameNode
  | FbtParamNode
  | FbtPluralNode
  | FbtPronounNode
  | FbtSameParamNode
  | FbtTextNode;

export type AnyFbtNode = FbtNode<
  AnyStringVariationArg | never,
  Node,
  FbtChildNode | null,
  Record<string, unknown> | null
>;

/**
 * Abstract representation of a JSX element.
 *
 * More exactly, it represents `JSXOpeningElement` which is the top-level AST node that
 * represents a JSX element.
 */
export type PlainJSXNode = {
  /**
   * The actual Babel AST node representing this JSX node internally.
   * Note that it may contain more contents at the JSX attributes level.
   * I.e. the JSX element's attributes are stored here,
   * but also exposed in a simplified way on the `props` field.
   */
  node: JSXOpeningElement;
  /**
   * Simplified representation of the JSX opening element's attributes for convenience.
   * We're currently only representing string literal attributes because it's not fully clear
   * how we'd want to represent other more complex types of attribute values.
   * If more complex types are needed, the Babel AST is available off the `node` field.
   */
  props: Readonly<{
    [name: string]: string | number;
  }>;
  /**
   * Type of the JSX element. E.g. "div", "strong", "ToolTipComponent", etc...
   * It's generic so that it can represent any arbitrary JSX element.
   */
  type: string;
};

/**
 * Representation of an Fbt node meant to be exported to external programs.
 *
 * - Recursive structure
 * - May provides a phrase index to help find strings produced from that fbt node. See `phraseIndex`
 * - May carry additional info about a JSX element that wraps this fbt node. See `wrapperNode`
 *
 *
 * Given an fbt like:
 *
 * ```
 * <fbt desc="...">
 *   Hello <strong>world</strong>
 * </fbt>
 * ```
 *
 * Then we would have a hierarchy like this:
 *
 * ```
 * {
 *   "phraseIndex": 0,
 *   "type": "element"
 *   "children": [
 *     {
 *       "type": "text"
 *     },
 *     {
 *       "phraseIndex": 1,
 *       "children": [
 *         {
 *           "type": "text"
 *         }
 *       ],
 *       "type": "implicitParam",
 *       "wrapperNode": {
 *         "type": "strong",
 *         "node": {
 *           "type": "JSXOpeningElement",
 *           ...
 *           "name": {
 *             "type": "JSXIdentifier",
 *             ...
 *             "name": "strong"
 *           },
 *           "attributes": [
 *             {
 *               "type": "JSXAttribute",
 *               ...
 *               "name": {
 *                 "type": "JSXIdentifier",
 *                 ...
 *                 "name": "color"
 *               },
 *               "value": {
 *                 "type": "StringLiteral",
 *                 ...
 *                 "extra": {
 *                   "rawValue": "red",
 *                   "raw": "\"red\""
 *                 },
 *                 "value": "red"
 *               }
 *             }
 *           ],
 *           "selfClosing": false
 *         },
 *         "props": {
 *           "color": "red"
 *         }
 *       }
 *     }
 *   ],
 * }
 * ```
 */
export type PlainFbtNode = {
  readonly children?: ReadonlyArray<PlainFbtNode>;
  /**
   * Index of the phrase corresponding to this fbt node in the `phrases` array.
   * @see {CollectFbtOutput.phrases}
   *
   * Not read-only because it needs to be set at a later stage, when all phrases have been extracted
   */
  phraseIndex?: number | null;
  type: FbtNodeType;
  /**
   * Abstract representation of a JSX element that wraps the current fbt node, if any.
   */
  wrapperNode?: PlainJSXNode | null;
};

/**
 * Base class that represents an fbt construct like <fbt>, <fbt:param>, etc...
 *
 * While nodes are considered "low-level" representations of the JS source code,
 * FbtNode is a high-level abstraction of the fbt API syntax.
 *
 * See `FbtElementNode` for more info on how this class will be used.
 *
 * We'll usually not use this class directly, favoring specialized child classes instead.
 */
export default abstract class FbtNode<
  SVArgument extends AnyStringVariationArg | never = never,
  CurrentNode extends Node = Node,
  MaybeChildNode extends FbtChildNode | null = null,
  Options extends Record<string, unknown> | null = null
> {
  readonly moduleName: BindingName;
  readonly children: Array<MaybeChildNode>;
  readonly node: CurrentNode;
  readonly nodeChecker: FbtNodeChecker;
  abstract readonly type: FbtNodeType;
  parent: AnyFbtNode | null = null;
  /**
   * Standardized "options" of the current fbt construct.
   *
   * I.e. the JSX attributes on `<fbt:construct {...options}>` or
   * the `options` argument from `fbt.construct(..., options)`
   */
  readonly options: Options;

  constructor({
    children,
    moduleName,
    node,
    parent,
    validExtraOptions,
  }: {
    children?: ReadonlyArray<MaybeChildNode> | null;
    moduleName: BindingName;
    node: CurrentNode;
    parent?: AnyFbtNode | null;
    validExtraOptions?: Readonly<FbtOptionConfig>;
  }) {
    this.moduleName = moduleName;
    this.node = node;
    if (parent != null) {
      this.parent = parent;
    }
    this.children = children != null ? [...children] : [];
    this.nodeChecker = FbtNodeChecker.forModule(moduleName);
    this.options = this.getOptions(validExtraOptions);
  }

  /**
   * Gather and standardize the valid "options" of the fbt construct.
   * @see {@link FbtNode#options}
   * @param _validExtraOptions
   *    Options allowed in addition to the standard options of this construct.
   *    This is only used by FbtElementNode at the moment, for which users of
   *    `babel-plugin-fbt` can specify custom options via `extraOptions` option.
   *
   * Note that the fbt construct's options will be stored in `this.options`
   * just after constructing this class instance.
   */
  getOptions(_validExtraOptions?: Readonly<FbtOptionConfig>): Options {
    throw errorAt(
      this.node,
      'This method must be implemented in a child class'
    );
  }

  setParent(parent: AnyFbtNode | null): this {
    this.parent = parent;
    return this;
  }

  appendChild(child?: MaybeChildNode | null): this {
    if (child != null) {
      this.children.push(child);
      child.setParent(this);
    }
    return this;
  }

  /**
   * Get the list of string variation arguments (SVArgument) for this node and all its children.
   * Note that the node tree is explored using the "postorder traversal" algorithm
   * (I.e. left, right, root)
   */
  getArgsForStringVariationCalc(): ReadonlyArray<SVArgument> {
    throw errorAt(
      this.node,
      'This method must be implemented in a child class'
    );
  }

  getText(_argsMap: StringVariationArgsMap): string {
    throw errorAt(
      this.node,
      'This method must be implemented in a child class'
    );
  }

  getTokenAliases(_argsMap: StringVariationArgsMap): TokenAliases | null {
    return null;
  }

  getTokenName(_argsMap: StringVariationArgsMap): string | null {
    return null;
  }

  /**
   * For debugging and unit tests:
   *
   * Since node objects are pretty deep and filled with low-level properties
   * that we don't really care about, we'll process any node property of this object so that:
   *
   *   - we convert the property value to a string like `'Node[type=SomeBabelType]'`
   *   - we add a new property like `__*propName*Code` whose value will
   *     be the JS source code of the original node.
   *
   * String variation arguments will also be serialized for debugging purpose.
   *
   * See snapshot `fbtFunctional-test.js.snap` to find output examples.
   */
  toJSON(): unknown {
    let stringVariationArgs;
    try {
      stringVariationArgs = this.getArgsForStringVariationCalc();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes(
          'This method must be implemented in a child class'
        )
      ) {
        stringVariationArgs = error;
      } else {
        throw error;
      }
    }

    const object: Record<string, unknown> = {
      ...compactNodeProps(this),
      __stringVariationArgs: stringVariationArgs,
      parent: this.parent != null ? this.parent.constructor.name : null,
    };

    if (this.options != null) {
      object.options = compactNodeProps(this.options);
    }

    delete object.type;
    Object.defineProperty(object, 'constructor', {
      enumerable: false,
      value: this.constructor,
    });
    return object;
  }

  toPlainFbtNode(): PlainFbtNode {
    return { type: this.type };
  }

  /**
   * Returns the node from this FbtNode only if it's a CallExpression
   */
  getCallNode(): CallExpression | null {
    return isCallExpression(this.node) ? this.node : null;
  }

  /**
   * Returns the list of node arguments of this fbt node
   * (assuming that it's based on a JS function call), or null.
   */
  getCallNodeArguments(): Array<CallExpressionArgument | null> | null {
    return this.getCallNode()?.arguments ?? null;
  }

  /**
   * Returns the first parent FbtNode that is an instance of the given class.
   */
  getFirstAncestorOfType<
    N extends Node,
    ChildNode extends MaybeChildNode | null,
    Class
  >(
    AncestorConstructor: new (x: {
      children?: ReadonlyArray<ChildNode>;
      moduleName: BindingName;
      node: N;
      parent?: AnyFbtNode | null;
      validExtraOptions?: Readonly<FbtOptionConfig>;
    }) => Class
  ): Class | null {
    for (let { parent } = this; parent != null; parent = parent.parent) {
      if (parent instanceof AncestorConstructor) {
        return parent;
      }
    }
    return null;
  }

  /**
   * Returns the fbt runtime argument (as a node) that will be used to by an fbt runtime call.
   * I.e.
   * Given the fbt runtime call:
   *
   *   fbt._(jsfbtTable, [
   *     <<runtimeFbtArg>>
   *   ])
   *
   * This method is responsible to generate <<runtimeFbtArg>>
   */
  getFbtRuntimeArg(): CallExpression | null {
    throw errorAt(
      this.node,
      'This method must be implemented in a child class'
    );
  }

  /**
   * Throws error if a function call or class instantiation call exists in
   * any of the fbt's arguments that have impact on string variation.
   *
   * Arguments that decide string variations:
   *  fbt:element: the 'subject' value
   *  fbt:enum: the 'enum' value
   *  fbt:name: the 'gender' value
   *  fbt:param: the 'gender/number' value. 'value' is okay
   *  fbt:plural: the 'count' value. 'value' is okay
   *  fbt:pronoun: the 'gender' value
   */
  throwIfAnyArgumentContainsFunctionCallOrClassInstantiation(scope: Scope) {
    const argsToCheck =
      this.getArgsThatShouldNotContainFunctionCallOrClassInstantiation();
    for (const argumentName of Object.keys(argsToCheck)) {
      const argument = argsToCheck[argumentName];
      if (isCallExpression(argument) || isNewExpression(argument)) {
        throw errorAt(
          this.node,
          `Expected string variation runtime argument "${argumentName}" ` +
            `to not be a function call or class instantiation expression. ` +
            `See https://fburl.com/i18n_js_fbt_extraction_limits`
        );
      }
      scope.traverse(
        argument,
        {
          'CallExpression|NewExpression'(path) {
            throw errorAt(
              path.node,
              `Expected string variation runtime argument "${argumentName}" ` +
                `to not contain a function call or class instantiation expression. ` +
                `See https://fburl.com/i18n_js_fbt_extraction_limits`
            );
          },
        },
        scope
      );
    }
  }

  getArgsThatShouldNotContainFunctionCallOrClassInstantiation(): Readonly<{
    [argName: string]: CallExpressionArg;
  }> {
    return {};
  }
}
