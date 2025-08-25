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
  isJSXFragment,
  isJSXNamespacedName,
  isStringLiteral,
  JSXAttribute,
  JSXElement,
  JSXExpressionContainer,
  jsxExpressionContainer,
  JSXNamespacedName,
  memberExpression,
  ObjectExpression,
  StringLiteral,
  stringLiteral,
} from '@babel/types';
import invariant from 'invariant';
import {
  ConcreteFbtNodeType,
  isConcreteFbtNode,
} from '../fbt-nodes/FbtNodeType.tsx';
import {
  getCommonDescription,
  getUnknownCommonStringErrorMessage,
} from '../FbtCommon.tsx';
import type { BindingName, FbtOptionConfig } from '../FbtConstants.tsx';
import {
  CommonOption,
  FbtRequiredAttributes,
  RequiredFbtAttributes,
  ValidFbtOptions,
} from '../FbtConstants.tsx';
import FbtNodeChecker from '../FbtNodeChecker.tsx';
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
  varDump,
} from '../FbtUtil.tsx';
import getNamespacedArgs from '../getNamespacedArgs.tsx';

type NodePath = NodePathT<JSXElement>;
type JSXElementChild = JSXElement['children'][number];

export default class JSXFbtProcessor {
  moduleName: BindingName;
  node: NodePath['node'];
  nodeChecker: FbtNodeChecker;
  path: NodePath;
  validFbtExtraOptions: Readonly<FbtOptionConfig>;
  _openingElementAttributes: ReadonlyArray<JSXAttribute> | null = null;

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

    const { node } = this;
    for (const attribute of node.openingElement.attributes) {
      if (attribute.type === 'JSXSpreadAttribute') {
        throw errorAt(
          node,
          `<${this.moduleName}> does not support spreading attributes.`,
        );
      }
    }
  }

  static create({
    path,
    validFbtExtraOptions,
  }: {
    path: NodePath;
    validFbtExtraOptions: Readonly<FbtOptionConfig>;
  }): JSXFbtProcessor | null {
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
    childNodes: Array<CallExpression | JSXElement | StringLiteral>,
  ): ArrayExpression {
    return convertToStringArrayNodeIfNeeded(
      this.moduleName,
      arrayExpression(childNodes),
    );
  }

  /**
   * @returns the description of the <fbt> as a , or null if it's a common string.
   */
  private getDescription(texts: ArrayExpression): StringLiteral | Expression {
    const { moduleName, node } = this;
    const commonAttributeValue = this.getCommonAttributeValue();
    let desc;

    if (commonAttributeValue && commonAttributeValue.value) {
      const rawTextValue = (texts.elements || [])
        .map((stringNode) => {
          try {
            invariant(
              isStringLiteral(stringNode),
              'Expected a StringLiteral but found `%s` instead',
              stringNode?.type || 'unknown',
            );
            return stringNode.value;
          } catch (error) {
            throw errorAt(stringNode, error);
          }
        })
        .join('');

      const textValue = normalizeSpaces(rawTextValue).trim();
      const descValue = getCommonDescription(textValue);
      if (descValue == null || descValue === '') {
        throw errorAt(
          node,
          getUnknownCommonStringErrorMessage(moduleName, textValue),
        );
      }
      if (getAttributeByName(this.node, 'desc')) {
        throw errorAt(
          node,
          `<${moduleName} common> must not have "desc" attribute.`,
        );
      }
      desc = stringLiteral(descValue);
    } else {
      desc = this.getDescAttributeValue();
    }
    return desc;
  }

  private getOptions(): ObjectExpression | null {
    const attributes = this.node.openingElement.attributes;
    this.assertHasMandatoryAttributes();
    const options =
      attributes.length > 0
        ? getOptionsFromAttributes(
            attributes,
            { ...this.validFbtExtraOptions, ...ValidFbtOptions },
            FbtRequiredAttributes,
          )
        : null;
    return (options?.properties.length ?? 0) > 0 ? options : null;
  }

  private assertHasMandatoryAttributes() {
    if (
      !this.node.openingElement.attributes.some(
        (attribute) =>
          attribute.type === 'JSXAttribute' &&
          attribute.name.type === 'JSXIdentifier' &&
          RequiredFbtAttributes.has(attribute.name.name),
      )
    ) {
      throw errorAt(
        this.node,
        `<${this.moduleName}> must have at least one of these attributes: ${[
          ...RequiredFbtAttributes,
        ].join(', ')}`,
      );
    }
  }

  private createFbtFunctionCallNode({
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

    if (isJSXElement(path.parent) || isJSXFragment(path.parent)) {
      const ret = jsxExpressionContainer(callNode);
      ret.loc = node.loc;
      return ret;
    }
    return callNode;
  }

  private assertNoNestedFbts() {
    this.nodeChecker.assertNoNestedFbts(this.node);
  }

  private transformChildrenForFbtCallSyntax(): Array<
    CallExpression | JSXElement | StringLiteral
  > {
    this.path.traverse({
      JSXElement: (path: NodePath) => {
        const { node } = path;
        if (!isJSXNamespacedName(node.openingElement.name)) {
          return;
        }

        const name = validateNamespacedFbtElement(
          this.moduleName,
          node.openingElement.name,
        );
        if (name) {
          const namespace = getNamespacedArgs(this.moduleName);
          const args = namespace[name as keyof typeof namespace](node);
          const fbtConstructCall = callExpression(
            memberExpression(
              identifier(this.moduleName),
              identifier(name),
              false,
            ),
            args as Array<CallExpressionArg>,
          );
          path.replaceWith(
            isJSXElement(path.parent) || isJSXFragment(path.parent)
              ? jsxExpressionContainer(fbtConstructCall)
              : fbtConstructCall,
          );
        }
      },
    });

    return (
      filterEmptyNodes(this.node.children) as ReadonlyArray<JSXElementChild>
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

            if (this.nodeChecker.getFbtNodeType(expression) != null) {
              // preserve fbt construct's function calls intact
              invariant(
                isCallExpression(expression),
                'Expected CallExpression value but received `%s` (%s)',
                varDump(expression),
                typeof expression,
              );
              return expression;
            }

            // otherwise, assume that we have textual nodes to return
            return stringLiteral(
              normalizeSpaces(
                expandStringConcat(this.moduleName, node.expression).value,
              ),
            );
          }
          default:
            throw errorAt(
              node,
              `Unsupported JSX element child type '${node.type}'`,
            );
        }
      } catch (error) {
        throw errorAt(node, error);
      }
    });
  }

  private getDescAttributeValue(): Expression {
    const { moduleName } = this;
    const descAttr = getAttributeByNameOrThrow(this.node, 'desc');
    const { node } = this;
    if (!descAttr || descAttr.value == null) {
      throw errorAt(node, `<${moduleName}> requires a "desc" attribute`);
    }
    switch (descAttr.value.type) {
      case 'JSXExpressionContainer':
        // @babel/parser should not allow this scenario normally
        invariant(
          descAttr.value.expression.type !== 'JSXEmptyExpression',
          'unexpected',
        );
        return descAttr.value.expression;
      case 'StringLiteral':
        return descAttr.value;
    }
    throw errorAt(
      node,
      `<${moduleName}> "desc" attribute must be a string literal ` +
        `or a non-empty JSX expression`,
    );
  }

  private getCommonAttributeValue(): null | BooleanLiteral {
    const commonAttr = getAttributeByName(this.node, CommonOption);
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
      `\`${CommonOption}\` attribute for <${this.moduleName}> requires boolean literal`,
    );
  }

  /**
   * This method mutates the current node.
   */
  convertToFbtFunctionCallNode(_phraseIndex: number) {
    this.assertNoNestedFbts();
    const children = this.transformChildrenForFbtCallSyntax();
    const text = this._getText(children);
    const description = this.getDescription(text);

    this.path.replaceWith(
      this.createFbtFunctionCallNode({
        desc: description,
        options: this.getOptions(),
        text,
      }),
    );
  }
}

const validateNamespacedFbtElement = (
  moduleName: string,
  node: JSXNamespacedName,
): ConcreteFbtNodeType | null => {
  const name = node.name.name === 'same-param' ? 'sameParam' : node.name.name;
  return name && node.namespace.name === moduleName && isConcreteFbtNode(name)
    ? name
    : null;
};
