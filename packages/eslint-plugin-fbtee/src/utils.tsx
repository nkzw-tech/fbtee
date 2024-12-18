// eslint-disable-next-line import/no-unresolved
import { ESLintUtils } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/utils';

export const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/nkzw-tech/fbtee/tree/main/packages/eslint-plugin-fbt/docs/rules/${name}`,
);

function resolveMemberExpressions(
  object: TSESTree.JSXTagNameExpression,
  property: TSESTree.JSXIdentifier,
): string {
  if (object.type === 'JSXMemberExpression') {
    return `${resolveMemberExpressions(object.object, object.property)}.${property.name}`;
  }

  return `${object.name}.${property.name}`;
}

export function elementType(
  node: TSESTree.JSXElement | TSESTree.JSXFragment,
): string {
  if (node.type === 'JSXFragment') {
    return '<>';
  }

  const { name } = node.openingElement;

  switch (name.type) {
    case 'JSXIdentifier': {
      return name.name;
    }

    case 'JSXMemberExpression': {
      const { object, property } = name;
      return resolveMemberExpressions(object, property);
    }

    case 'JSXNamespacedName': {
      return `${name.namespace.name}:${name.name.name}`;
    }

    default: {
      throw new Error('Unsupported JSX node type.');
    }
  }
}

export function resolveJsxElementTextContent(
  node: TSESTree.JSXElement,
): string {
  return node.children
    .map((child) => {
      if (child.type === 'JSXText') {
        return child.value.trim();
      }

      if (child.type === 'JSXExpressionContainer') {
        return resolveNodeValue(child.expression) || '';
      }

      return '';
    })
    .join('')
    .trim();
}

export function resolveBinaryExpression(
  node: TSESTree.BinaryExpression,
): string | null {
  if (node.operator !== '+') {
    return null;
  }

  const leftValue = resolveNodeValue(node.left);
  const rightValue = resolveNodeValue(node.right);

  if (leftValue !== null && rightValue !== null) {
    return leftValue + rightValue;
  }

  return null;
}

export function resolveNodeValue(
  node:
    | TSESTree.Expression
    | TSESTree.JSXExpression
    | TSESTree.JSXEmptyExpression
    | TSESTree.PrivateIdentifier,
): string | null {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }

  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map((quasi) => quasi.value.raw).join('');
  }

  if (node.type === 'BinaryExpression') {
    return resolveBinaryExpression(node);
  }

  if (node.type === 'JSXExpressionContainer') {
    return resolveNodeValue(node.expression);
  }

  return null;
}
