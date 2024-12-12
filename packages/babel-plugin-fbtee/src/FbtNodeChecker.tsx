import type { NodePath } from '@babel/core';
import {
  isCallExpression,
  isIdentifier,
  isJSXElement,
  isJSXNamespacedName,
  isMemberExpression,
  JSXElement,
  Node,
} from '@babel/types';
import { FbtNodeType, getNodeType } from './fbt-nodes/FbtNodeType.tsx';
import {
  FbsBindingName,
  FbtBindingName,
  type BindingName,
} from './FbtConstants.tsx';
import { errorAt } from './FbtUtil.tsx';

export default class FbtNodeChecker {
  constructor(public readonly moduleName: BindingName) {}

  isNameOfModule(name: string): boolean {
    return this.moduleName === FbtBindingName
      ? FbtNodeChecker.isFbtName(name)
      : FbtNodeChecker.isFbsName(name);
  }

  isJSXElement(node: Node): boolean {
    if (!isJSXElement(node)) {
      return false;
    }
    const nameNode = node.openingElement.name;
    return (
      nameNode.type === 'JSXIdentifier' && this.isNameOfModule(nameNode.name)
    );
  }

  isJSXNamespacedElement(node: Node): boolean {
    if (!isJSXElement(node)) {
      return false;
    }
    const nameNode = node.openingElement.name;
    return (
      isJSXNamespacedName(nameNode) &&
      this.isNameOfModule(nameNode.namespace.name)
    );
  }

  // Detects this pattern: `fbt(...)`
  isModuleCall(node: Node): boolean {
    return (
      isCallExpression(node) &&
      isIdentifier(node.callee) &&
      this.isNameOfModule(node.callee.name)
    );
  }

  getFbtNodeType(node: Node): FbtNodeType | null {
    return (
      (isCallExpression(node) &&
        isMemberExpression(node.callee) &&
        isIdentifier(node.callee.object) &&
        this.isNameOfModule(node.callee.object.name) &&
        isIdentifier(node.callee.property) &&
        getNodeType(node.callee.property.name)) ||
      null
    );
  }

  isMemberExpression(node: Node): boolean {
    return (
      isMemberExpression(node) &&
      isIdentifier(node.object) &&
      this.isNameOfModule(node.object.name)
    );
  }

  isJSModuleBound<T extends Node>(path: NodePath<T>): boolean {
    const binding = path.context.scope.getBinding(this.moduleName);
    return !!(binding && binding.path.node);
  }

  // Detects this pattern: `fbt.c(...)`
  isCommonStringCall(node: Node): boolean {
    return (
      isCallExpression(node) &&
      isMemberExpression(node.callee) &&
      this.isMemberExpression(node.callee) &&
      !node.callee.computed &&
      node.callee.property.type === 'Identifier' &&
      node.callee.property.name === FbtNodeChecker.COMMON_STRING_METHOD_NAME
    );
  }

  /**
   * Ensure that, given an <fbt/fbs> JSXElement, we don't have any nested <fbt/fbs> element.
   * And also checks that all "parameter" child elements follow the same namespace.
   * E.g.
   * Inside <fbt>, don't allow <fbs:param>.
   * Inside <fbs>, don't allow <fbt:param>.
   */
  assertNoNestedFbts(node: JSXElement) {
    const moduleName = this.moduleName;
    for (const child of node.children) {
      if (
        isJSXElement(child) &&
        (fbtChecker.isJSXElement(child) || fbsChecker.isJSXElement(child))
      ) {
        const nestedJSXElementName =
          child.openingElement.name.type === 'JSXIdentifier'
            ? child.openingElement.name.name
            : null;
        const rootJSXElementName =
          node.openingElement.name.type === 'JSXIdentifier'
            ? node.openingElement.name.name
            : null;

        throw errorAt(
          child,
          `Don't put <${nestedJSXElementName}> directly within <${rootJSXElementName}>. ` +
            `This is redundant. The text is already translated so you don't need ` +
            `to translate it again`,
        );
      } else {
        const otherChecker =
          moduleName === FbsBindingName ? fbtChecker : fbsChecker;
        const node = isJSXElement(child) ? child : null;
        if (
          node &&
          otherChecker.isJSXNamespacedElement(node) &&
          node.openingElement.name.type === 'JSXNamespacedName'
        ) {
          const name = node.openingElement.name;
          throw errorAt(
            child,
            `Don't mix <fbt> and <fbs> JSX namespaces. ` +
              `Found a <${name.namespace.name}:${name.name.name}> ` +
              `directly within a <${moduleName}>`,
          );
        }
      }
    }
  }

  static forModule(moduleName: string): FbtNodeChecker {
    return moduleName === FbtBindingName ? fbtChecker : fbsChecker;
  }

  static isFbtName(name: string): boolean {
    return name === FbtBindingName;
  }

  static isFbsName(name: string): boolean {
    return name === FbsBindingName;
  }

  static forFbtCommonFunctionCall(node: Node): FbtNodeChecker | null {
    return fbtChecker.isCommonStringCall(node)
      ? fbtChecker
      : fbsChecker.isCommonStringCall(node)
        ? fbsChecker
        : null;
  }

  static forFbtFunctionCall(node: Node): FbtNodeChecker | null {
    return fbtChecker.isModuleCall(node)
      ? fbtChecker
      : fbsChecker.isModuleCall(node)
        ? fbsChecker
        : null;
  }

  static forJSXFbt(node: Node): FbtNodeChecker | null {
    return fbtChecker.isJSXElement(node)
      ? fbtChecker
      : fbsChecker.isJSXElement(node)
        ? fbsChecker
        : null;
  }

  /**
   * This is same as the non-static getFbtConstructNameFromFunctionCall except
   * it accepts any of the three fbt modules (`FBT`, `FBS`).
   */
  static getFbtNodeTypeFromFunctionCall(node: Node): FbtNodeType | null {
    return (
      (isCallExpression(node) &&
        isMemberExpression(node.callee) &&
        isIdentifier(node.callee.object) &&
        isIdentifier(node.callee.property) &&
        (node.callee.object.name === FbtBindingName ||
          node.callee.object.name === FbsBindingName) &&
        getNodeType(node.callee.property.name)) ||
      null
    );
  }

  static readonly COMMON_STRING_METHOD_NAME = 'c';
}

const fbsChecker = new FbtNodeChecker(FbsBindingName);
const fbtChecker = new FbtNodeChecker(FbtBindingName);
