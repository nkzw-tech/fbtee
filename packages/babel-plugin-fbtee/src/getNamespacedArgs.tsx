import {
  JSXElement,
  jsxExpressionContainer,
  Node,
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
  getAttributeByNameOrThrow,
  getOptionsFromAttributes,
  normalizeSpaces,
} from './FbtUtil.tsx';

export default function getNamespacedArgs(
  moduleName: string
): Record<ConcreteFbtNodeType, (node: JSXElement) => Array<Node | null>> {
  return {
    /**
     * <fbt:enum> or <FbtEnum>
     */
    enum(node: JSXElement) {
      if (!node.openingElement.selfClosing) {
        throw errorAt(node, `Expected ${moduleName}:enum to be selfClosing.`);
      }

      const rangeAttr = getAttributeByNameOrThrow(
        node.openingElement.attributes,
        'enum-range'
      );

      if (rangeAttr.value?.type !== 'JSXExpressionContainer') {
        throw errorAt(
          node,
          'Expected JSX Expression for enum-range attribute but got ' +
            rangeAttr.value?.type
        );
      }

      const valueAttr = getAttributeByNameOrThrow(
        node.openingElement.attributes,
        'value'
      );

      if (valueAttr.value?.type === 'JSXExpressionContainer') {
        return [valueAttr.value.expression, rangeAttr.value.expression];
      } else if (valueAttr.value?.type === 'StringLiteral') {
        return [valueAttr.value, rangeAttr.value.expression];
      }

      throw errorAt(
        node,
        `Expected value attribute of <${moduleName}:enum> to be an expression ` +
          `but got ${valueAttr.value?.type}`
      );
    },

    /**
     * <fbt:name> or <FbtName>
     */
    name(node: JSXElement) {
      const attributes = node.openingElement.attributes;
      const nameAttribute = getAttributeByNameOrThrow(attributes, 'name').value;
      const genderAttribute = getAttributeByNameOrThrow(
        attributes,
        'gender'
      ).value;

      const children = filterEmptyNodes(node.children).filter(
        (child) =>
          child.type === 'JSXText' || child.type === 'JSXExpressionContainer'
      );
      if (children.length !== 1) {
        throw errorAt(
          node,
          `${moduleName}:name expects text or an expression, and only one`
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
        nameAttribute,
        singularArg,
        genderAttribute?.type === 'JSXExpressionContainer'
          ? genderAttribute.expression
          : null,
      ];
    },

    /**
     * <fbt:param> or <FbtParam>
     */
    param(node: JSXElement) {
      const attributes = node.openingElement.attributes;
      const nameAttr = getAttributeByNameOrThrow(attributes, 'name');
      const options = getOptionsFromAttributes(
        attributes,
        ValidParamOptions,
        RequiredParamOptions
      );

      let children = filterEmptyNodes(node.children).filter((child) => {
        return (
          child.type === 'JSXExpressionContainer' || child.type === 'JSXElement'
        );
      });

      // <fbt:param> </fbt:param>
      // should be the equivalent of
      // <fbt:param>{' '}</fbt:param>
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
          `${moduleName}:param expects an {expression} or JSX element, and only one`
        );
      }

      const nameAttrValue = nameAttr.value;
      if (
        nameAttrValue?.type === 'StringLiteral' &&
        nameAttrValue.loc &&
        nameAttrValue.loc.end.line > nameAttrValue.loc.start.line
      ) {
        nameAttrValue.value = normalizeSpaces(nameAttrValue.value);
      }
      const paramArgs = [
        nameAttrValue,
        (children[0].type === 'JSXExpressionContainer' &&
          children[0].expression) ||
          children[0],
      ];

      if (options.properties.length > 0) {
        paramArgs.push(options);
      }

      return paramArgs;
    },

    /**
     * <fbt:plural> or <FbtPlural>
     */
    plural(node: JSXElement) {
      const attributes = node.openingElement.attributes;
      const options = getOptionsFromAttributes(
        attributes,
        PluralOptions,
        PluralRequiredAttributes
      );
      const countAttr = getAttributeByNameOrThrow(attributes, 'count').value;
      const children = filterEmptyNodes(node.children).filter(
        (child) =>
          child.type === 'JSXText' || child.type === 'JSXExpressionContainer'
      );
      if (children.length !== 1) {
        throw errorAt(
          node,
          `${moduleName}:plural expects text or an expression, and only one`
        );
      }
      const singularNode = children[0];
      const singularText = expandStringConcat(
        moduleName,
        (singularNode.type === 'JSXExpressionContainer' &&
          singularNode.expression) ||
          singularNode
      );
      const singularArg = stringLiteral(
        normalizeSpaces(singularText.value).trimRight()
      );
      return [
        singularArg,
        countAttr?.type === 'JSXExpressionContainer'
          ? countAttr.expression
          : null,
        options,
      ];
    },

    /**
     * <fbt:pronoun> or <FbtPronoun>
     */
    pronoun(node: JSXElement) {
      if (!node.openingElement.selfClosing) {
        throw errorAt(
          node,
          `${moduleName}:pronoun must be a self-closing element`
        );
      }

      const attributes = node.openingElement.attributes;
      const typeAttr = getAttributeByNameOrThrow(attributes, 'type').value;
      if (typeAttr?.type !== 'StringLiteral') {
        throw errorAt(
          node,
          `${moduleName}:pronoun attribute "type" must have StringLiteral content`
        );
      }
      if (
        !Object.prototype.hasOwnProperty.call(
          ValidPronounUsages,
          typeAttr.value
        )
      ) {
        throw errorAt(
          node,
          `${moduleName}:pronoun attribute "type" must be one of [` +
            Object.keys(ValidPronounUsages) +
            ']'
        );
      }
      const result: Array<Node> = [stringLiteral(typeAttr.value)];

      const genderExpr = getAttributeByNameOrThrow(attributes, 'gender').value;
      if (genderExpr?.type === 'JSXExpressionContainer') {
        result.push(genderExpr.expression);
      }

      const options = getOptionsFromAttributes(
        attributes,
        ValidPronounOptions,
        PronounRequiredAttributes
      );
      if (0 < options.properties.length) {
        result.push(options);
      }

      return result;
    },

    /**
     * <fbt:same-param> or <FbtSameParam>
     */
    sameParam(node: JSXElement) {
      if (!node.openingElement.selfClosing) {
        throw errorAt(
          node,
          `Expected ${moduleName}:same-param to be selfClosing.`
        );
      }

      const nameAttr = getAttributeByNameOrThrow(
        node.openingElement.attributes,
        'name'
      );

      return [nameAttr.value];
    },
  };
}
