import {
  isJSXExpressionContainer,
  isStringLiteral,
  JSXElement,
  jsxExpressionContainer,
  Node,
  nullLiteral,
  stringLiteral,
} from '@babel/types';
import { ConcreteFbtNodeType } from './fbt-nodes/FbtNodeType.tsx';
import {
  PluralOptions,
  PluralRequiredAttributes,
  PronounRequiredAttributes,
  RequiredParamOptions,
  ValidParamOptions,
  ValidPronounOptions,
  ValidPronounUsages,
} from './FbtConstants.tsx';
import {
  errorAt,
  expandStringConcat,
  filterEmptyNodes,
  getAttributeByName,
  getAttributeByNameOrThrow,
  getOptionsFromAttributes,
  normalizeSpaces,
} from './FbtUtil.tsx';

export default function getNamespacedArgs(
  moduleName: string,
): Record<ConcreteFbtNodeType, (node: JSXElement) => Array<Node>> {
  return {
    enum(node: JSXElement) {
      if (!node.openingElement.selfClosing) {
        throw errorAt(node, `<${moduleName}:enum> must be self-closing.`);
      }

      const range = getAttributeByNameOrThrow(node, 'enum-range');
      if (range.value?.type !== 'JSXExpressionContainer') {
        throw errorAt(
          node,
          `Attribute 'enum-range' on <${moduleName}:enum> must be a JSX expression. ` +
            `Received '${range.value?.type ?? 'missing'}'.`,
        );
      }

      const value = getAttributeByNameOrThrow(node, 'value');
      if (value.value?.type === 'JSXExpressionContainer') {
        return [value.value.expression, range.value.expression];
      } else if (value.value?.type === 'StringLiteral') {
        return [value.value, range.value.expression];
      }

      throw errorAt(
        node,
        `Attribute 'value' on <${moduleName}:enum> must be an expression or string. ` +
          `Received '${value.value?.type ?? 'missing'}'.`,
      );
    },

    list(node: JSXElement) {
      if (!node.openingElement.selfClosing) {
        throw errorAt(node, `<${moduleName}:list> must be self-closing.`);
      }

      const name = getAttributeByNameOrThrow(node, 'name').value;
      const items = getAttributeByNameOrThrow(node, 'items');

      if (!isJSXExpressionContainer(items.value)) {
        throw errorAt(
          node,
          `<${moduleName}:list> attribute 'items' must be a JSX expression.`,
        );
      }

      const conjunction = getAttributeByName(node, 'conjunction');
      const delimiter = getAttributeByName(node, 'delimiter');
      return [
        name,
        items.value.expression,
        isStringLiteral(conjunction?.value)
          ? conjunction.value
          : isJSXExpressionContainer(conjunction?.value)
            ? conjunction.value
            : nullLiteral(),
        isStringLiteral(delimiter?.value)
          ? delimiter.value
          : isJSXExpressionContainer(delimiter?.value)
            ? delimiter.value.expression
            : nullLiteral(),
      ];
    },

    name(node: JSXElement) {
      const name = getAttributeByNameOrThrow(node, 'name').value;
      const genderAttribute = getAttributeByNameOrThrow(node, 'gender').value;

      const children = filterEmptyNodes(node.children).filter(
        (child) =>
          child.type === 'JSXText' || child.type === 'JSXExpressionContainer',
      );
      if (children.length !== 1) {
        throw errorAt(
          node,
          `<${moduleName}:name> needs exactly one child: text or an expression.`,
        );
      }

      let singularArg =
        (children[0].type === 'JSXExpressionContainer' &&
          children[0].expression) ||
        children[0];
      if (singularArg.type === 'JSXText') {
        singularArg = stringLiteral(normalizeSpaces(singularArg.value));
      }

      return [
        name,
        singularArg,
        genderAttribute?.type === 'JSXExpressionContainer'
          ? genderAttribute.expression
          : nullLiteral(),
      ];
    },

    param(node: JSXElement) {
      const attributes = node.openingElement.attributes;
      const name = getAttributeByNameOrThrow(node, 'name').value;
      const options = getOptionsFromAttributes(
        attributes,
        ValidParamOptions,
        RequiredParamOptions,
      );

      let children = filterEmptyNodes(node.children).filter((child) => {
        return (
          child.type === 'JSXExpressionContainer' ||
          child.type === 'JSXElement' ||
          child.type === 'JSXFragment'
        );
      });

      // <fbt:param> </fbt:param> should be the equivalent of <fbt:param>{' '}</fbt:param>
      if (
        children.length === 0 &&
        node.children.length === 1 &&
        node.children[0].type === 'JSXText' &&
        node.children[0].value === ' '
      ) {
        children = [
          jsxExpressionContainer(stringLiteral(node.children[0].value)),
        ];
      }

      if (children.length !== 1) {
        throw errorAt(
          node,
          `<${moduleName}:param> needs exactly one child: an expression or JSX element.`,
        );
      }

      if (
        name?.type === 'StringLiteral' &&
        name.loc &&
        name.loc.end.line > name.loc.start.line
      ) {
        name.value = normalizeSpaces(name.value);
      }
      const paramArgs = [
        name,
        (children[0].type === 'JSXExpressionContainer' &&
          children[0].expression) ||
          children[0],
      ];

      if (options.properties.length > 0) {
        paramArgs.push(options);
      }

      return paramArgs;
    },

    plural(node: JSXElement) {
      const attributes = node.openingElement.attributes;
      const options = getOptionsFromAttributes(
        attributes,
        PluralOptions,
        PluralRequiredAttributes,
      );
      const count = getAttributeByNameOrThrow(node, 'count').value;
      const children = filterEmptyNodes(node.children).filter(
        (child) =>
          child.type === 'JSXText' || child.type === 'JSXExpressionContainer',
      );
      if (children.length !== 1) {
        throw errorAt(
          node,
          `<${moduleName}:plural> needs exactly one child: text or an expression.`,
        );
      }
      const singularNode = children[0];
      const singularText = expandStringConcat(
        moduleName,
        (singularNode.type === 'JSXExpressionContainer' &&
          singularNode.expression) ||
          singularNode,
      );
      const singularArg = stringLiteral(
        normalizeSpaces(singularText.value).trimEnd(),
      );
      return [
        singularArg,
        count?.type === 'JSXExpressionContainer'
          ? count.expression
          : nullLiteral(),
        options,
      ];
    },

    pronoun(node: JSXElement) {
      if (!node.openingElement.selfClosing) {
        throw errorAt(node, `<${moduleName}:pronoun> must be self-closing.`);
      }

      const attributes = node.openingElement.attributes;
      const typeAttribute = getAttributeByNameOrThrow(node, 'type').value;
      if (typeAttribute?.type !== 'StringLiteral') {
        throw errorAt(
          node,
          `<${moduleName}:pronoun> attribute 'type' must be a string literal.`,
        );
      }
      if (
        !Object.prototype.hasOwnProperty.call(
          ValidPronounUsages,
          typeAttribute.value,
        )
      ) {
        throw errorAt(
          node,
          `<${moduleName}:pronoun> attribute 'type' must be one of: ${Object.keys(
            ValidPronounUsages,
          ).join(', ')}. Received '${typeAttribute.value}'.`,
        );
      }

      const result: Array<Node> = [stringLiteral(typeAttribute.value)];
      const genderExpr = getAttributeByNameOrThrow(node, 'gender').value;
      if (genderExpr?.type === 'JSXExpressionContainer') {
        result.push(genderExpr.expression);
      }

      const options = getOptionsFromAttributes(
        attributes,
        ValidPronounOptions,
        PronounRequiredAttributes,
      );
      if (0 < options.properties.length) {
        result.push(options);
      }

      return result;
    },

    sameParam(node: JSXElement) {
      if (!node.openingElement.selfClosing) {
        throw errorAt(node, `<${moduleName}:same-param> must be self-closing.`);
      }

      return [getAttributeByNameOrThrow(node, 'name').value];
    },
  };
}
