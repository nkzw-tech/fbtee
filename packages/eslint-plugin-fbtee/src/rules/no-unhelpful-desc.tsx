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
  create(context) {
    return {
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
            messageId: 'emptyDesc',
            node: descArg || node,
          });
          return;
        }

        if (desc.length <= 4) {
          context.report({
            messageId: 'shortDesc',
            node: descArg || node,
          });
          return;
        }

        const text =
          textArg && textArg.type !== 'SpreadElement'
            ? resolveNodeValue(textArg)?.trim()
            : null;

        if (desc.toLowerCase() === text?.toLowerCase()) {
          context.report({
            messageId: 'duplicateDesc',
            node: descArg || node,
          });
        }
      },

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
            messageId: 'jsxEmptyDesc',
            node: node.value,
          });
          return;
        }

        if (desc.length <= 4) {
          context.report({
            messageId: 'shortDesc',
            node: node.value,
          });
          return;
        }

        const textContent = resolveJsxElementTextContent(node.parent.parent);

        if (desc.toLowerCase() === textContent.toLowerCase()) {
          context.report({
            messageId: 'duplicateDesc',
            node: node.value,
          });
        }
      },
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description:
        'Enforce meaningful and non-empty descriptions in <fbt> elements and fbt()/fbs() function calls.',
    },
    messages: {
      duplicateDesc:
        'The "desc" attribute or argument should not be a duplicate of the text content.',
      emptyDesc: 'The "desc" argument in fbt() and fbs() must not be empty.',
      jsxEmptyDesc: 'The "desc" attribute in <fbt> must not be empty.',
      shortDesc:
        'The "desc" attribute or argument is too short. Use a more descriptive and meaningful explanation.',
    },
    schema: [],
    type: 'problem',
  },
  name: 'no-unhelpful-desc',
});
