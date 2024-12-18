/* eslint-disable sort-keys-fix/sort-keys-fix */
import {
  createRule,
  elementType,
  resolveJsxElementTextContent,
  resolveNodeValue,
} from '../utils.tsx';

export default createRule<
  [],
  'emptyDesc' | 'jsxEmptyDesc' | 'duplicateDesc' | 'shortDesc'
>({
  name: 'no-unhelpful-desc',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce meaningful and non-empty descriptions in <fbt> elements and fbt()/fbs() function calls.',
    },
    messages: {
      jsxEmptyDesc: 'The "desc" attribute in <fbt> must not be empty.',
      emptyDesc: 'The "desc" argument in fbt() and fbs() must not be empty.',
      duplicateDesc:
        'The "desc" attribute or argument should not be a duplicate of the text content.',
      shortDesc:
        'The "desc" attribute or argument is too short. Use a more descriptive and meaningful explanation.',
    },
    schema: [],
  },
  defaultOptions: [],

  create(context) {
    return {
      JSXAttribute(node) {
        if (elementType(node.parent.parent) !== 'fbt') {
          return;
        }

        if (node.name.name !== 'desc' || !node.value) {
          return;
        }

        if (
          node.value.type === 'JSXExpressionContainer' &&
          (node.value.expression.type === 'Identifier' ||
            node.value.expression.type === 'CallExpression')
        ) {
          return;
        }

        const desc = resolveNodeValue(node.value)?.trim();

        if (!desc) {
          context.report({
            node: node.value,
            messageId: 'jsxEmptyDesc',
          });
          return;
        }

        if (desc.length <= 4) {
          context.report({
            node: node.value,
            messageId: 'shortDesc',
          });
          return;
        }

        const textContent = resolveJsxElementTextContent(node.parent.parent);

        if (desc.toLowerCase() === textContent.toLowerCase()) {
          context.report({
            node: node.value,
            messageId: 'duplicateDesc',
          });
        }
      },

      CallExpression(node) {
        if (
          node.callee.type !== 'Identifier' ||
          !(node.callee.name === 'fbt' || node.callee.name === 'fbs')
        ) {
          return;
        }

        const [textArg, descArg] = node.arguments;

        const desc =
          descArg && descArg.type !== 'SpreadElement'
            ? resolveNodeValue(descArg)?.trim()
            : null;

        if (!desc) {
          context.report({
            node: descArg || node,
            messageId: 'emptyDesc',
          });
          return;
        }

        if (desc.length <= 4) {
          context.report({
            node: descArg || node,
            messageId: 'shortDesc',
          });
          return;
        }

        const text =
          textArg && textArg.type !== 'SpreadElement'
            ? resolveNodeValue(textArg)?.trim()
            : null;

        if (desc.toLowerCase() === text?.toLowerCase()) {
          context.report({
            node: descArg || node,
            messageId: 'duplicateDesc',
          });
        }
      },
    };
  },
});
