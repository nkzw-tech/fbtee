import {
  createRule,
  getPropName,
  hasFbtParent,
  isFbtNode,
  resolveNodeValue,
} from '../utils.tsx';

type Options = [{ ignoredWords: Array<string> }];

const attributes = new Set([
  'title',
  'placeholder',
  'alt',
  'label',
  'aria-label',
  'aria-errormessage',
]);

export default createRule<Options, 'unwrappedString'>({
  create(context, options) {
    const ignoredWords = new Set(
      options[0].ignoredWords.map((s) => s.trim().toLowerCase()),
    );

    function isIgnoredWord(value: string) {
      return ignoredWords.has(value.trim().toLowerCase());
    }

    return {
      JSXAttribute(node) {
        const propName = getPropName(node);

        if (!attributes.has(propName)) {
          return;
        }

        const value = node.value ? resolveNodeValue(node.value) : null;

        if (!value) {
          return;
        }

        if (isIgnoredWord(value)) {
          return;
        }

        if (
          node.value?.type === 'JSXExpressionContainer' &&
          isFbtNode(node.value.expression)
        ) {
          return;
        }

        context.report({
          messageId: 'unwrappedString',
          node,
        });
      },

      JSXExpressionContainer(node) {
        if (node.parent.type === 'JSXAttribute') {
          return;
        }

        const value = resolveNodeValue(node.expression);

        if (!value) {
          return;
        }

        if (isIgnoredWord(value)) {
          return;
        }

        if (!hasFbtParent(node)) {
          context.report({
            messageId: 'unwrappedString',
            node,
          });
        }
      },

      JSXText(node) {
        const value = node.value.trim();

        if (!value) {
          return;
        }

        if (isIgnoredWord(value)) {
          return;
        }

        if (!hasFbtParent(node)) {
          const startOffset = node.range[0] + node.value.indexOf(value);
          const endOffset = startOffset + value.length;

          context.report({
            loc: {
              end: context.sourceCode.getLocFromIndex(endOffset),
              start: context.sourceCode.getLocFromIndex(startOffset),
            },
            messageId: 'unwrappedString',
          });
        }
      },
    };
  },

  defaultOptions: [{ ignoredWords: [] }],

  meta: {
    docs: {
      description:
        'Enforce text content to be wrapped with `<fbt>`, `fbt()` or `fbs()`',
    },
    messages: {
      unwrappedString:
        'Text content must be wrapped in `<fbt>`, `fbt()` or `fbs()`',
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          ignoredWords: {
            items: {
              type: 'string',
            },
            type: 'array',
            uniqueItems: true,
          },
        },
        type: 'object',
      },
    ],
    type: 'problem',
  },

  name: 'no-untranslated-strings',
});
