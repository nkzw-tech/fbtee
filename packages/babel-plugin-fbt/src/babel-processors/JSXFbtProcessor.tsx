import type { NodePath as NodePathT } from '@babel/core';
import {
  ArrayExpression,
  arrayExpression,
  BooleanLiteral,
  booleanLiteral,
  CallExpression,
  callExpression,
  Expression,
  identifier,
  isCallExpression,
  isJSXElement,
  isStringLiteral,
  JSXAttribute,
  JSXElement,
  JSXExpressionContainer,
  jsxExpressionContainer,
  memberExpression,
  ObjectExpression,
  StringLiteral,
  stringLiteral,
} from '@babel/types';
import invariant from 'invariant';
import { getDesc, getUnknownCommonStringErrorMessage } from '../FbtCommon';
import type { FbtOptionConfig, JSModuleNameType } from '../FbtConstants';
import {
  CommonOption,
  FbtCallMustHaveAtLeastOneOfTheseAttributes,
  FbtRequiredAttributes,
  ValidFbtOptions,
} from '../FbtConstants';
import FbtNodeChecker from '../FbtNodeChecker';
import {
  CallExpressionArg,
  convertToStringArrayNodeIfNeeded,
  errorAt,
  expandStringConcat,
  filterEmptyNodes,
  getAttributeByName,
  getAttributeByNameOrThrow,
  getOptionsFromAttributes,
  normalizeSpaces,
  validateNamespacedFbtElement,
  varDump,
} from '../FbtUtil';
import getNamespacedArgs from '../getNamespacedArgs';

type NodePath = NodePathT<JSXElement>;
type BabelNodeJSXElementChild = JSXElement['children'][number];

export default class JSXFbtProcessor {
  moduleName: JSModuleNameType;
  node: NodePath['node'];
  nodeChecker: FbtNodeChecker;
  path: NodePath;
  validFbtExtraOptions: Readonly<FbtOptionConfig>;
  _openingElementAttributes: ReadonlyArray<JSXAttribute> | null | undefined;

  constructor({
    nodeChecker,
    path,
    validFbtExtraOptions,
  }: {
    nodeChecker: FbtNodeChecker;
    path: NodePath;
    validFbtExtraOptions: Readonly<FbtOptionConfig>;
  }) {
    this.moduleName = nodeChecker.moduleName;
    this.node = path.node;
    this.nodeChecker = nodeChecker;
    this.path = path;
    this.validFbtExtraOptions = validFbtExtraOptions;
  }

  static create({
    path,
    validFbtExtraOptions,
  }: {
    path: NodePath;
    validFbtExtraOptions: Readonly<FbtOptionConfig>;
  }): JSXFbtProcessor | null | undefined {
    const nodeChecker = FbtNodeChecker.forJSXFbt(path.node);
    return nodeChecker != null
      ? new JSXFbtProcessor({
          nodeChecker,
          path,
          validFbtExtraOptions,
        })
      : null;
  }

  _getText(
    childNodes: Array<CallExpression | JSXElement | StringLiteral>
  ): ArrayExpression {
    return convertToStringArrayNodeIfNeeded(
      this.moduleName,
      arrayExpression(childNodes)
    );
  }

  /**
   * @returns the description of the <fbt> as a , or null if it's a common string.
   */
  _getDescription(texts: ArrayExpression): StringLiteral | Expression {
    const { moduleName, node } = this;
    const commonAttributeValue = this._getCommonAttributeValue();
    let desc;

    if (commonAttributeValue && commonAttributeValue.value) {
      const rawTextValue = (texts.elements || [])
        .map((stringNode) => {
          try {
            invariant(
              isStringLiteral(stringNode),
              'Expected a StringLiteral but found `%s` instead',
              stringNode?.type || 'unknown'
            );
            return stringNode.value;
          } catch (error: any) {
            throw errorAt(stringNode, error.message);
          }
        })
        .join('');

      const textValue = normalizeSpaces(rawTextValue).trim();
      const descValue = getDesc(textValue);
      if (descValue == null || descValue === '') {
        throw errorAt(
          node,
          getUnknownCommonStringErrorMessage(moduleName, textValue)
        );
      }
      if (getAttributeByName(this._getOpeningElementAttributes(), 'desc')) {
        throw errorAt(
          node,
          `<${moduleName} common={true}> must not have "desc" attribute`
        );
      }
      desc = stringLiteral(descValue);
    } else {
      desc = this._getDescAttributeValue();
    }
    return desc;
  }

  _getOptions(): ObjectExpression | null {
    // Optional attributes to be passed as options.
    const attrs = this._getOpeningElementAttributes();
    this._assertHasMandatoryAttributes();
    const options =
      attrs.length > 0
        ? getOptionsFromAttributes(
            attrs,
            { ...this.validFbtExtraOptions, ...ValidFbtOptions },
            FbtRequiredAttributes
          )
        : null;
    return (options?.properties.length ?? 0) > 0 ? options : null;
  }

  _getOpeningElementAttributes(): ReadonlyArray<JSXAttribute> {
    if (this._openingElementAttributes != null) {
      return this._openingElementAttributes;
    }

    const { node } = this;
    this._openingElementAttributes = node.openingElement.attributes.map(
      (attribute) => {
        if (attribute.type === 'JSXSpreadAttribute') {
          throw errorAt(
            node,
            `<${this.moduleName}> does not support JSX spread attribute`
          );
        }
        return attribute;
      }
    );
    return this._openingElementAttributes;
  }

  _assertHasMandatoryAttributes(): void {
    if (
      this._getOpeningElementAttributes().find(
        (attribute) =>
          attribute.name.type === 'JSXIdentifier' &&
          FbtCallMustHaveAtLeastOneOfTheseAttributes.has(attribute.name.name)
      ) == null
    ) {
      throw errorAt(
        this.node,
        `<${this.moduleName}> must have at least ` +
          `one of these attributes: ${[
            ...FbtCallMustHaveAtLeastOneOfTheseAttributes,
          ].join(', ')}`
      );
    }
  }

  _createFbtFunctionCallNode({
    desc,
    options,
    text,
  }: {
    desc: StringLiteral | Expression;
    options: ObjectExpression | null;
    text: ArrayExpression;
  }): CallExpression | JSXExpressionContainer {
    const { moduleName, node, path } = this;
    invariant(text != null, 'text cannot be null');
    invariant(desc != null, 'desc cannot be null');
    const args = [text, desc];

    if (options != null) {
      args.push(options);
    }

    const callNode = callExpression(identifier(moduleName), args);
    callNode.loc = node.loc;

    if (isJSXElement(path.parent)) {
      const ret = jsxExpressionContainer(callNode);
      ret.loc = node.loc;
      return ret;
    }
    return callNode;
  }

  _assertNoNestedFbts() {
    this.nodeChecker.assertNoNestedFbts(this.node);
  }

  _transformChildrenForFbtCallSyntax(): Array<
    CallExpression | JSXElement | StringLiteral
  > {
    this.path.traverse(jsxFbtConstructToFunctionalFormTransform, {
      moduleName: this.moduleName,
    });
    return (
      filterEmptyNodes(
        this.node.children
      ) as ReadonlyArray<BabelNodeJSXElementChild>
    ).map((node) => {
      try {
        switch (node.type) {
          case 'JSXElement':
            // This should already be a simple JSX element (non-fbt construct)
            return node;
          case 'JSXText':
            return stringLiteral(normalizeSpaces(node.value));
          case 'JSXExpressionContainer': {
            const { expression } = node;

            if (
              this.nodeChecker.getFbtConstructNameFromFunctionCall(
                expression
              ) != null
            ) {
              // preserve fbt construct's function calls intact
              invariant(
                isCallExpression(expression),
                'Expected BabelNodeCallExpression value but received `%s` (%s)',
                varDump(expression),
                typeof expression
              );
              return expression;
            }

            // otherwise, assume that we have textual nodes to return
            return stringLiteral(
              normalizeSpaces(
                expandStringConcat(this.moduleName, node.expression).value
              )
            );
          }
          default:
            throw errorAt(
              node,
              `Unsupported JSX element child type '${node.type}'`
            );
        }
      } catch (error: any) {
        throw errorAt(node, error.message);
      }
    });
  }

  _getDescAttributeValue(): Expression {
    const { moduleName } = this;
    const descAttr = getAttributeByNameOrThrow(
      this._getOpeningElementAttributes(),
      'desc'
    );
    const { node } = this;
    if (!descAttr || descAttr.value == null) {
      throw errorAt(node, `<${moduleName}> requires a "desc" attribute`);
    }
    switch (descAttr.value.type) {
      case 'JSXExpressionContainer':
        // @babel/parser should not allow this scenario normally
        invariant(
          descAttr.value.expression.type !== 'JSXEmptyExpression',
          'unexpected'
        );
        return descAttr.value.expression;
      case 'StringLiteral':
        return descAttr.value;
    }
    throw errorAt(
      node,
      `<${moduleName}> "desc" attribute must be a string literal ` +
        `or a non-empty JSX expression`
    );
  }

  _getCommonAttributeValue(): null | BooleanLiteral {
    const commonAttr = getAttributeByName(
      this._getOpeningElementAttributes(),
      CommonOption
    );
    if (commonAttr == null) {
      return null;
    }

    // A JSX/HTML tag attribute without value is default to boolean value true.
    // E.g. `<fbt common>Done</fbt>`
    const commonAttrValue = commonAttr.value;
    if (commonAttrValue == null) {
      return booleanLiteral(true);
    }

    // E.g. `<fbt common={true}>Done</fbt>`
    if (commonAttrValue.type === 'JSXExpressionContainer') {
      const expression = commonAttrValue.expression;
      if (expression.type === 'BooleanLiteral') {
        return expression;
      }
    }

    throw new Error(
      `\`${CommonOption}\` attribute for <${this.moduleName}> requires boolean literal`
    );
  }

  /**
   * This method mutates the current Babel node
   */
  convertToFbtFunctionCallNode(_phraseIndex: number): void {
    this._assertNoNestedFbts();
    const children = this._transformChildrenForFbtCallSyntax();
    const text = this._getText(children);
    const description = this._getDescription(text);

    this.path.replaceWith(
      this._createFbtFunctionCallNode({
        text,
        desc: description,
        options: this._getOptions(),
      })
    );
  }
}

/**
 * Traverse all JSXElements, replace those that are JSX fbt constructs (e.g. <fbt:param>)
 * to their functional form equivalents (e.g. fbt.param()).
 */
const jsxFbtConstructToFunctionalFormTransform = {
  JSXElement(path: NodePath) {
    const { node } = path;
    const { moduleName } = this as unknown as { moduleName: JSModuleNameType };
    const name = validateNamespacedFbtElement(
      moduleName,
      node.openingElement.name
    );
    if (name !== 'implicitParamMarker') {
      const namespace = getNamespacedArgs(moduleName);
      const args = namespace[name as keyof typeof namespace](node);
      let fbtConstructCall: CallExpression | JSXExpressionContainer =
        callExpression(
          memberExpression(identifier(moduleName), identifier(name), false),
          args as Array<CallExpressionArg>
        );
      if (isJSXElement(path.parent)) {
        fbtConstructCall = jsxExpressionContainer(fbtConstructCall);
      }
      path.replaceWith(fbtConstructCall);
    }
  },
} as const;
