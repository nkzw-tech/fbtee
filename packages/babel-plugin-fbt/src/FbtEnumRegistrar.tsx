import path from 'path';
import type { NodePath } from '@babel/core';
import {
  CallExpression,
  ImportDeclaration,
  isImportDefaultSpecifier,
  isImportNamespaceSpecifier,
} from '@babel/types';
import { FBT_ENUM_MODULE_SUFFIX } from './FbtConstants';

type NodeCallExpression = NodePath<CallExpression>;
type NodeImportDeclaration = NodePath<ImportDeclaration>;
export type EnumKey = string;
type EnumValue = string;
export type EnumModule = Partial<Record<EnumKey, EnumValue>>;
export type EnumManifest = {
  readonly [enumModuleName: string]: EnumModule | null | undefined;
};

const fbtEnumMapping: {
  [enumAlias: string]: string | null | undefined;
} = {};

let enumManifest: EnumManifest | null | undefined;

export default new (class FbtEnumRegistrar {
  /**
   * Set the enum manifest. I.e. a mapping of enum module names -> enum entries
   */
  setEnumManifest(manifest?: EnumManifest | null): void {
    enumManifest = manifest;
  }

  /**
   * Associate a JS variable name to an Fbt enum module name
   * If the module name is invalid, then it's a no-op.
   */
  setModuleAlias(alias: string, modulePath: string): void {
    const moduleName = path.parse(modulePath).name;
    if (!moduleName.endsWith(FBT_ENUM_MODULE_SUFFIX)) {
      return;
    }
    fbtEnumMapping[alias] = moduleName;
  }

  /**
   * Returns the Fbt enum module name for a given variable name (if any)
   */
  getModuleName(name: string): string | null | undefined {
    return fbtEnumMapping[name];
  }

  /**
   * Returns the Fbt enum module name for a given variable name (if any)
   */
  getEnum(variableName: string): EnumModule | null | undefined {
    const moduleName = this.getModuleName(variableName);
    return enumManifest != null && moduleName != null
      ? enumManifest[moduleName]
      : null;
  }

  /**
   * Processes a `require(...)` call and registers the fbt enum if applicable.
   * @param path Babel path of a `require(...)` call expression
   */
  registerRequireIfApplicable(path: NodeCallExpression): void {
    const { node } = path;
    const firstArgument = node.arguments[0];
    if (firstArgument.type !== 'StringLiteral') {
      return;
    }
    const modulePath = firstArgument.value;
    const parentNode = path.parentPath.node;
    const alias =
      parentNode.type === 'VariableDeclarator' &&
      parentNode.id.type === 'Identifier'
        ? parentNode.id.name
        : null;
    if (alias) {
      this.setModuleAlias(alias, modulePath);
    }
  }

  /**
   * Processes a `import ... from '...';` statement and registers the fbt enum
   * if applicable.
   *
   * We only support the following top level import styles:
   *   - `import anEnum from 'Some$FbtEnum';`
   *   - `import * as aEnum from 'Some$FbtEnum';`
   *
   * @param path Babel path of a `import` statement
   */
  registerImportIfApplicable(path: NodeImportDeclaration): void {
    const { node } = path;

    if (node.specifiers.length > 1) {
      return;
    }

    const specifier = node.specifiers[0];
    if (
      isImportDefaultSpecifier(specifier) ||
      isImportNamespaceSpecifier(specifier)
    ) {
      const alias = specifier.local.name;
      const modulePath = node.source.value;
      this.setModuleAlias(alias, modulePath);
    }
  }
})();
