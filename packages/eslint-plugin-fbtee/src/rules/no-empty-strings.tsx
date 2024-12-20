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
        const nodesToReport = new Set<TSESTree.Node>();
        const hasTextContent = validateChildren(node, nodesToReport);

        if (!hasTextContent) {
          for (const node of nodesToReport) {
            context.report({
              messageId: 'jsxEmptyString',
              node,
            });
          }
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
  nodesToReport: Set<TSESTree.Node>,
): boolean {
  let hasTextContent = false;

  for (const child of node.children) {
    if (child.type === 'JSXText' && node.children.length === 1) {
      if (child.value.trim() === '') {
        nodesToReport.add(child);
      } else {
        hasTextContent = true;
      }
    }

    if (
      child.type === 'JSXExpressionContainer' &&
      child.expression.type !== 'JSXEmptyExpression'
    ) {
      if (
        isEmptyString(child.expression) &&
        (node.children.length === 1 ||
          node.children.every(
            (otherChild) =>
              child === otherChild ||
              (otherChild.type === 'JSXText' && otherChild.value.trim() === ''),
          ))
      ) {
        nodesToReport.add(child.expression);
      } else {
        hasTextContent = true;
      }
    }

    if (child.type === 'JSXElement' || child.type === 'JSXFragment') {
      const childName = elementType(child);

      if (/^[A-Z]/.test(childName) || childName.startsWith('fbt:')) {
        hasTextContent = true;
        continue;
      }

      hasTextContent ||= validateChildren(child, nodesToReport);
    }

    if (hasTextContent) {
      break;
    }
  }

  if (!hasTextContent && nodesToReport.size === 0) {
    nodesToReport.add(node);
  }

  return hasTextContent;
}

function isEmptyString(node: TSESTree.Expression | TSESTree.Literal): boolean {
  return resolveNodeValue(node)?.trim() === '';
}
