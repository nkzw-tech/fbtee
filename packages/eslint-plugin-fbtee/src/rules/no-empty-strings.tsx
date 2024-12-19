/* eslint-disable sort-keys-fix/sort-keys-fix */
import type { TSESTree } from '@typescript-eslint/utils';
import { createRule, elementType } from '../utils.tsx';

export default createRule<
  [],
  'emptyText' | 'jsxEmptyText' | 'emptyDesc' | 'jsxEmptyDesc'
>({
  name: 'no-empty-strings',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow empty strings in fbt elements or function calls.',
    },
    messages: {
      jsxEmptyText: 'Empty strings are not allowed as children of <fbt> tags.',
      emptyText:
        'Empty strings are not allowed in fbt() or fbs() function arguments.',
      jsxEmptyDesc: '<fbt> elements must have a non-empty string description.',
      emptyDesc: 'fbt() and fbs() must have a non-empty string description.',
    },
    schema: [],
  },
  defaultOptions: [],

  create(context) {
    return {
      JSXElement(node) {
        if (elementType(node) !== 'fbt') {
          return;
        }

        // Validate the `desc` attribute to ensure it is not empty.
        for (const attr of node.openingElement.attributes) {
          if (
            attr.type === 'JSXAttribute' &&
            attr.name.name === 'desc' &&
            attr.value
          ) {
            const value = attr.value;

            if (value.type === 'Literal' && value.value === '') {
              context.report({
                node: value,
                messageId: 'jsxEmptyDesc',
              });
            }

            if (value.type === 'JSXExpressionContainer') {
              const expression = value.expression;

              if (
                expression.type !== 'JSXEmptyExpression' &&
                isEmptyString(expression)
              ) {
                context.report({
                  node: expression,
                  messageId: 'jsxEmptyDesc',
                });
              }
            }
          }
        }

        //  Collect nodes to report and validate all children recursively.
        const nodesToReport = new Set<TSESTree.Node>();
        const hasTextContent = validateChildren(node, nodesToReport);

        if (!hasTextContent) {
          for (const node of nodesToReport) {
            context.report({
              node,
              messageId: 'jsxEmptyText',
            });
          }
        }
      },

      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          !(node.callee.name === 'fbt' || node.callee.name === 'fbs')
        ) {
          return;
        }

        const [text, desc] = node.arguments;

        if (text && text.type !== 'SpreadElement' && isEmptyString(text)) {
          context.report({
            node: text,
            messageId: 'emptyText',
          });
        }

        if (desc && desc.type !== 'SpreadElement' && isEmptyString(desc)) {
          context.report({
            node: desc,
            messageId: 'emptyDesc',
          });
        }
      },
    };
  },
});

function validateChildren(
  node: TSESTree.JSXElement,
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
      if (isEmptyString(child.expression)) {
        nodesToReport.add(child.expression);
      } else {
        hasTextContent = true;
      }
    }

    if (child.type === 'JSXElement') {
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
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value.trim() === '';
  }
  return (
    node.type === 'TemplateLiteral' &&
    node.quasis.length === 1 &&
    node.quasis[0].value.raw.trim() === ''
  );
}
