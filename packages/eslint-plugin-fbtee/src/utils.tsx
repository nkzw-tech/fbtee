import { ESLintUtils } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/utils';

export const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/nkzw-tech/fbtee/blob/main/packages/eslint-plugin-fbtee/docs/rules/${name}.md`,
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
  node: TSESTree.JSXElement | TSESTree.JSXFragment,
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

  if (node.type === 'ConditionalExpression') {
    const consequent = resolveNodeValue(node.consequent);
    const alternate = resolveNodeValue(node.alternate);

    return consequent || alternate || null;
  }

  if (node.type === 'LogicalExpression') {
    const left = resolveNodeValue(node.left);
    const right = resolveNodeValue(node.right);

    return left || right || null;
  }

  return null;
}

export function getPropName(prop: TSESTree.JSXAttribute) {
  if (prop.name.type === 'JSXNamespacedName') {
    return `${prop.name.namespace.name}:${prop.name.name.name}`;
  }

  return prop.name.name;
}

export function hasFbtParent(node: TSESTree.Node) {
  let current = node.parent;

  while (current) {
    if (isFbtNode(current)) {
      return true;
    }
    current = current.parent;
  }

  return false;
}

export function isFbtNode(node?: TSESTree.Node) {
  if (!node) {
    return null;
  }

  if (node.type === 'JSXElement') {
    const name = elementType(node);
    return name === 'fbt' || name === 'fbs' || name?.startsWith('fbt:');
  }

  if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
    const name = node.callee.name;
    return name === 'fbt' || name === 'fbs';
  }

  if (
    node.type === 'MemberExpression' &&
    node.object.type === 'CallExpression' &&
    node.object.callee.type === 'Identifier'
  ) {
    const name = node.object.callee.name;
    return name === 'fbt' || name === 'fbs';
  }

  return false;
}
