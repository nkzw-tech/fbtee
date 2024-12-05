import type { Scope } from '@babel/traverse';
import { default as traverse } from '@babel/traverse';
import {
  CallExpression,
  isCallExpression,
  isNewExpression,
  JSXOpeningElement,
  Node,
} from '@babel/types';
import invariant from 'invariant';
import type { FbtOptionConfig, JSModuleNameType } from '../FbtConstants';
import FbtNodeChecker from '../FbtNodeChecker';
import type {
  BabelNodeCallExpressionArgument,
  CallExpressionArg,
} from '../FbtUtil';
import { compactBabelNodeProps, errorAt, varDump } from '../FbtUtil';
import type { TokenAliases } from '../index';
import type {
  AnyStringVariationArg,
  StringVariationArgsMap,
} from './FbtArguments';
import type FbtEnumNode from './FbtEnumNode';
import type FbtImplicitParamNode from './FbtImplicitParamNode';
import type FbtNameNode from './FbtNameNode';
import { FbtNodeType } from './FbtNodeType';
import type FbtParamNode from './FbtParamNode';
import type FbtPluralNode from './FbtPluralNode';
import type FbtPronounNode from './FbtPronounNode';
import type FbtSameParamNode from './FbtSameParamNode';
import type FbtTextNode from './FbtTextNode';

export type FbtChildNode =
  | FbtEnumNode
  | FbtImplicitParamNode
  | FbtNameNode
  | FbtParamNode
  | FbtPluralNode
  | FbtPronounNode
  | FbtSameParamNode
  | FbtTextNode;

export type AnyFbtNode = FbtNode<any, any, any, any>;

/**
 * Abstract representation of a JSX element.
 *
 * More exactly, it represents `BabelNodeJSXOpeningElement` which is the top-level AST node that
 * represents a JSX element.
 */
export type PlainJSXNode = {
  /**
   * Type of the JSX element. E.g. "div", "strong", "ToolTipComponent", etc...
   * It's generic so that it can represent any arbitrary JSX element.
   */
  type: string;
  /**
   * The actual Babel AST node representing this JSX node internally.
   * Note that it may contain more contents at the JSX attributes level.
   * I.e. the JSX element's attributes are stored here,
   * but also exposed in a simplified way on the `props` field.
   */
  babelNode: JSXOpeningElement;
  /**
   * Simplified representation of the JSX opening element's attributes for convenience.
   * We're currently only representing string literal attributes because it's not fully clear
   * how we'd want to represent other more complex types of attribute values.
   * If more complex types are needed, the Babel AST is available off the `babelNode` field.
   */
  props: Readonly<{
    [name: string]: string | number;
  }>;
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
 *         "babelNode": {
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
  type: FbtNodeType;
  readonly children?: ReadonlyArray<PlainFbtNode>;
  /**
   * Index of the phrase corresponding to this fbt node in the `phrases` array.
   * @see {CollectFbtOutput.phrases}
   *
   * Not read-only because it needs to be set at a later stage, when all phrases have been extracted
   */
  phraseIndex?: number | null | undefined;
  /**
   * Abstract representation of a JSX element that wraps the current fbt node, if any.
   */
  wrapperNode?: PlainJSXNode | null | undefined;
};

/**
 * Base class that represents an fbt construct like <fbt>, <fbt:param>, etc...
 *
 * While Babel nodes are considered "low-level" representations of the JS source code,
 * FbtNode is a high-level abstraction of the fbt API syntax.
 *
 * See `FbtElementNode` for more info on how this class will be used.
 *
 * We'll usually not use this class directly, favoring specialized child classes instead.
 */
export default class FbtNode<
  SVArgument extends AnyStringVariationArg | never = never,
  CurrentNode extends Node = Node,
  MaybeChildNode extends FbtChildNode | null | undefined = null, // See related docs of this.options
  Options extends Record<any, any> | null | undefined = null
> {
  readonly moduleName: JSModuleNameType;
  readonly children: Array<MaybeChildNode>;
  readonly node: CurrentNode;
  readonly nodeChecker: FbtNodeChecker;
  parent: AnyFbtNode | null | undefined;
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
    children?: ReadonlyArray<MaybeChildNode> | null | undefined;
    moduleName: JSModuleNameType;
    node: CurrentNode;
    parent?: AnyFbtNode | null | undefined;
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
    this.initCheck();
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

  /**
   * Run integrity checks to ensure this fbt construct is in a valid state
   * These checks are non-exhaustive. Some new exceptions may arise later on.
   */
  initCheck(): void {}

  setParent(parent?: AnyFbtNode | null): this {
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

  getTokenAliases(
    _argsMap: StringVariationArgsMap
  ): TokenAliases | null | undefined {
    return null;
  }

  getTokenName(_argsMap: StringVariationArgsMap): string | null | undefined {
    return null;
  }

  /**
   * For debugging and unit tests:
   *
   * Since BabelNode objects are pretty deep and filled with low-level properties
   * that we don't really care about, we'll process any BabelNode property of this object so that:
   *
   *   - we convert the property value to a string like `'BabelNode[type=SomeBabelType]'`
   *   - we add a new property like `__*propName*Code` whose value will
   *     be the JS source code of the original BabelNode.
   *
   * String variation arguments will also be serialized for debugging purpose.
   *
   * See snapshot `fbtFunctional-test.js.snap` to find output examples.
   */
  toJSON(): unknown {
    let stringVariationArgs;
    try {
      stringVariationArgs = this.getArgsForStringVariationCalc();
    } catch (error: any) {
      if (
        error.message.includes(
          'This method must be implemented in a child class'
        )
      ) {
        stringVariationArgs = error;
      } else {
        throw error;
      }
    }

    const ret: Record<string, unknown> = {
      ...compactBabelNodeProps(this as unknown as Record<string, unknown>),
      __stringVariationArgs: stringVariationArgs,
      // Avoid cyclic recursion issues
      parent: this.parent != null ? this.parent.constructor.name : this.parent,
    };

    if (this.options != null) {
      ret.options = compactBabelNodeProps(this.options);
    }

    Object.defineProperty(ret, 'constructor', {
      value: this.constructor,
      enumerable: false,
    });
    return ret;
  }

  /**
   * Returns a JSON-friendly representation of this instance that can be consumed
   * in other programming languages.
   * NOTE: this only represents the current node but not its children!
   */
  toPlainFbtNode(): PlainFbtNode {
    const type =
      FbtNodeType[
        (this.constructor as unknown as { type: 'string' })
          .type as unknown as keyof typeof FbtNodeType
      ];
    invariant(
      type != null,
      'Expected instance constructor.type property to be a string instead of `%s`',
      varDump(type)
    );
    return { type };
  }

  /**
   * Returns the Babel node from this FbtNode only if it's a BabelNodeCallExpression
   */
  getCallNode(): CallExpression | null | undefined {
    return isCallExpression(this.node) ? this.node : null;
  }

  /**
   * Returns the list of BabelNode arguments of this fbt node
   * (assuming that it's based on a JS function call), or null.
   */
  getCallNodeArguments():
    | Array<BabelNodeCallExpressionArgument | null | undefined>
    | null
    | undefined {
    const callNode = this.getCallNode();
    return callNode ? callNode.arguments : null;
  }

  /**
   * Returns the first parent FbtNode that is an instance of the given class.
   */
  getFirstAncestorOfType<N extends Node, Class>(
    AncestorConstructor: new (x: {
      children?: ReadonlyArray<MaybeChildNode> | null | undefined;
      moduleName: JSModuleNameType;
      node: N;
      parent?: AnyFbtNode | null | undefined;
      validExtraOptions?: Readonly<FbtOptionConfig>;
    }) => Class
  ): Class | null | undefined {
    for (let { parent } = this; parent != null; parent = parent.parent) {
      if (parent instanceof AncestorConstructor) {
        return parent;
      }
    }
    return null;
  }

  /**
   * Returns the fbt runtime argument (as a BabelNode) that will be used to by an fbt runtime call.
   * I.e.
   * Given the fbt runtime call:
   *
   *   fbt._(jsfbtTable, [
   *     <<runtimeFbtArg>>
   *   ])
   *
   * This method is responsible to generate <<runtimeFbtArg>>
   */
  getFbtRuntimeArg(): CallExpression | null | undefined {
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
  throwIfAnyArgumentContainsFunctionCallOrClassInstantiation(
    scope: Scope
  ): void {
    const argsToCheck =
      this.getArgsThatShouldNotContainFunctionCallOrClassInstantiation();
    for (const argumentName in argsToCheck) {
      const argument = argsToCheck[argumentName];
      if (isCallExpression(argument) || isNewExpression(argument)) {
        throw errorAt(
          this.node,
          `Expected string variation runtime argument "${argumentName}" ` +
            `to not be a function call or class instantiation expression. ` +
            `See https://fburl.com/i18n_js_fbt_extraction_limits`
        );
      }
      // Look for function or class call nested in the argument
      traverse(
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
