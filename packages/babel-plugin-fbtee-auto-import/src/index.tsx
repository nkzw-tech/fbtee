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
import { BindingNames, ModuleName } from '@nkzw/babel-plugin-fbtee';

export default function autoImport() {
  let root: NodePath<Program> | null = null;

  return {
    visitor: {
      JSXElement(path: NodePath<JSXElement>) {
        const name = path.node.openingElement.name;
        if (
          isJSXIdentifier(name) &&
          BindingNames.has(name.name) &&
          !path.context.scope.getBinding(name.name)
        ) {
          const declaration = importDeclaration(
            [importSpecifier(identifier(name.name), identifier(name.name))],
            stringLiteral(ModuleName),
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
