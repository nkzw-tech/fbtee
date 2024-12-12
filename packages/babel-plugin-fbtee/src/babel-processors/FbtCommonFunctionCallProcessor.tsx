import type { NodePath as NodePathT } from '@babel/core';
import {
  booleanLiteral,
  callExpression,
  CallExpression,
  identifier,
  objectExpression,
  objectProperty,
  stringLiteral,
} from '@babel/types';
import {
  getCommonDescription,
  getUnknownCommonStringErrorMessage,
} from '../FbtCommon.tsx';
import type { BindingName } from '../FbtConstants.tsx';
import { CommonOption } from '../FbtConstants.tsx';
import FbtNodeChecker from '../FbtNodeChecker.tsx';
import { errorAt, expandStringConcat, normalizeSpaces } from '../FbtUtil.tsx';

type NodePath = NodePathT<CallExpression>;

/**
 * This class provides utility methods to process the node of the fbt common function call.
 * I.e. `fbt.c(...)`
 */
export default class FbtCommonFunctionCallProcessor {
  moduleName: BindingName;
  node: NodePath['node'];
  path: NodePath;

  constructor({
    moduleName,
    path,
  }: {
    moduleName: BindingName;
    path: NodePath;
  }) {
    this.moduleName = moduleName;
    this.node = path.node;
    this.path = path;
  }

  static create({
    path,
  }: {
    path: NodePath;
  }): FbtCommonFunctionCallProcessor | null {
    const nodeChecker = FbtNodeChecker.forFbtCommonFunctionCall(path.node);
    return nodeChecker != null
      ? new FbtCommonFunctionCallProcessor({
          moduleName: nodeChecker.moduleName,
          path,
        })
      : null;
  }

  /**
   * Converts an Fbt common call of the form `fbt.c(text)` to the basic form `fbt(text, desc)`
   */
  convertToNormalCall(): CallExpression {
    const { moduleName, node } = this;
    if (node.arguments.length !== 1) {
      throw errorAt(
        node,
        `Expected ${moduleName}.c to have exactly 1 argument. ${node.arguments.length} was given.`
      );
    }

    const text = normalizeSpaces(
      expandStringConcat(moduleName, node.arguments[0]).value
    ).trim();

    const desc = getCommonDescription(text);
    if (desc == null || desc === '') {
      throw errorAt(node, getUnknownCommonStringErrorMessage(moduleName, text));
    }

    const callNode = callExpression(identifier(moduleName), [
      stringLiteral(text),
      stringLiteral(desc),
      objectExpression([
        objectProperty(identifier(CommonOption), booleanLiteral(true)),
      ]),
    ]);

    callNode.loc = node.loc;
    return callNode;
  }
}
