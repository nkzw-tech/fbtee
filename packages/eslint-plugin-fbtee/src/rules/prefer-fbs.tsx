import { ASTUtils, TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils.tsx';

function unwrap(node: TSESTree.Node): TSESTree.Node {
  while (
    node.type === 'TSAsExpression' ||
    node.type === 'TSTypeAssertion' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'ChainExpression'
  ) {
    node = node.expression;
  }
  return node;
}

export default createRule<[], 'preferFbs'>({
  create(context) {
    function isFbt(node: TSESTree.Node): boolean {
      if (node.type !== 'Identifier') {
        return false;
      }
      const variable = ASTUtils.findVariable(context.sourceCode.getScope(node), node.name);
      const imported = variable?.defs.find((definition) => definition.type === 'ImportBinding');
      if (imported) {
        return (
          imported.parent.type === 'ImportDeclaration' &&
          (imported.parent.source.value === 'fbtee' ||
            imported.parent.source.value === 'fbtee/server') &&
          (imported.node.type === 'ImportDefaultSpecifier' ||
            (imported.node.type === 'ImportSpecifier' &&
              (imported.node.imported.type === 'Identifier'
                ? imported.node.imported.name
                : imported.node.imported.value) === 'fbt'))
        );
      }
      return (
        node.name === 'fbt' &&
        !variable?.defs.some((definition) => definition.type === 'FunctionName')
      );
    }

    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'String') {
          return;
        }
        const string = ASTUtils.findVariable(context.sourceCode.getScope(node), 'String');
        if (string?.defs.length || !node.arguments[0]) {
          return;
        }
        const argument = unwrap(node.arguments[0]);
        if (
          argument.type === 'JSXElement' &&
          argument.openingElement.name.type === 'JSXIdentifier' &&
          argument.openingElement.name.name === 'fbt'
        ) {
          context.report({ messageId: 'preferFbs', node });
          return;
        }
        if (argument.type !== 'CallExpression') {
          return;
        }
        const callee = unwrap(argument.callee);
        if (
          isFbt(callee) ||
          (callee.type === 'MemberExpression' &&
            isFbt(unwrap(callee.object)) &&
            ((!callee.computed &&
              callee.property.type === 'Identifier' &&
              callee.property.name === 'c') ||
              (callee.computed &&
                callee.property.type === 'Literal' &&
                callee.property.value === 'c')))
        ) {
          context.report({ messageId: 'preferFbs', node });
        }
      },
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: 'Require fbs() instead of String(fbt(...)) for translated text.',
    },
    messages: {
      preferFbs:
        'Use fbs() or fbs.c() instead of String() on an fbt result. Rich fbt results stringify to "[object Object]".',
    },
    schema: [],
    type: 'problem',
  },
  name: 'prefer-fbs',
});
