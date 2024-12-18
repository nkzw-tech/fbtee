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
