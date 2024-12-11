import { NodePath } from '@babel/core';
import {
  identifier,
  importDeclaration,
  importSpecifier,
  isJSXIdentifier,
  JSXElement,
  Program,
  stringLiteral,
} from '@babel/types';

export default function autoImport() {
  let root: NodePath<Program> | null = null;

  return {
    visitor: {
      JSXElement(path: NodePath<JSXElement>) {
        if (
          isJSXIdentifier(path.node.openingElement.name) &&
          path.node.openingElement.name.name === 'fbt' &&
          !path.context.scope.getBinding('fbt')
        ) {
          const declaration = importDeclaration(
            [importSpecifier(identifier('fbt'), identifier('fbt'))],
            stringLiteral('fbt')
          );

          if (root) {
            const [importPath] = root.unshiftContainer('body', declaration);
            root.scope.registerBinding('module', importPath);
          }
        }
      },
      Program(path: NodePath<Program>) {
        root = path;
      },
    },
  };
}
