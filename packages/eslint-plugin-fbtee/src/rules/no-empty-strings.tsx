import type { TSESTree } from '@typescript-eslint/utils';
import { createRule, elementType, resolveNodeValue } from '../utils.tsx';

export default createRule<[], 'emptyString' | 'jsxEmptyString'>({
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== 'Identifier' ||
          !(node.callee.name === 'fbt' || node.callee.name === 'fbs')
        ) {
          return;
        }

        const [text] = node.arguments;

        if (text && text.type !== 'SpreadElement' && isEmptyString(text)) {
          context.report({
            messageId: 'emptyString',
            node: text,
          });
        }
      },

      JSXElement(node) {
        if (elementType(node) !== 'fbt') {
          return;
        }

        //  Collect nodes to report and validate all children recursively.
        const hasTextContent = validateChildren(node);

        if (!hasTextContent) {
          context.report({
            messageId: 'jsxEmptyString',
            node,
          });
        }
      },
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: 'Disallow empty strings in fbt elements or function calls.',
    },
    messages: {
      emptyString:
        'Empty strings are not allowed in fbt() or fbs() function arguments.',
      jsxEmptyString:
        'Empty strings are not allowed as children of <fbt> tags.',
    },
    schema: [],
    type: 'problem',
  },
  name: 'no-empty-strings',
});

function validateChildren(
  node: TSESTree.JSXElement | TSESTree.JSXFragment,
): boolean {
  let hasTextContent = false;

  for (const child of node.children) {
    if (child.type === 'JSXText' && child.value.trim() !== '') {
      hasTextContent = true;
    }

    if (child.type === 'JSXExpressionContainer') {
      if (child.expression.type === 'JSXEmptyExpression') {
        continue;
      }

      // Ignore when a variable is used <fbt desc="Greeting">{dynamicValue}</fbt>
      if (
        child.expression.type === 'Identifier' &&
        child.expression.name !== 'undefined'
      ) {
        hasTextContent = true;
        continue;
      }

      const value = resolveNodeValue(child.expression)?.trim();

      if (value) {
        hasTextContent = true;
      }
    }

    if (child.type === 'JSXElement' || child.type === 'JSXFragment') {
      const childName = elementType(child);

      if (/^[A-Z]/.test(childName) || childName.startsWith('fbt:')) {
        hasTextContent = true;
        continue;
      }

      hasTextContent ||= validateChildren(child);
    }

    if (hasTextContent) {
      break;
    }
  }

  return hasTextContent;
}

function isEmptyString(node: TSESTree.Expression | TSESTree.Literal): boolean {
  return resolveNodeValue(node)?.trim() === '';
}
