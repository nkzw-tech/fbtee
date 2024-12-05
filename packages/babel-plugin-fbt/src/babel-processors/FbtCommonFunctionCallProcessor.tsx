import type { NodePath as NodePathT } from '@babel/core';
import type BabelTypes from '@babel/types';
import { CallExpression } from '@babel/types';
import { getDesc, getUnknownCommonStringErrorMessage } from '../FbtCommon';
import type { JSModuleNameType } from '../FbtConstants';
import { CommonOption } from '../FbtConstants';
import FbtNodeChecker from '../FbtNodeChecker';
import { errorAt, expandStringConcat, normalizeSpaces } from '../FbtUtil';

type NodePath = NodePathT<CallExpression>;

/**
 * This class provides utility methods to process the babel node of the fbt common function call.
 * I.e. `fbt.c(...)`
 */
export default class FbtCommonFunctionCallProcessor {
  moduleName: JSModuleNameType;
  node: NodePath['node'];
  path: NodePath;
  t: typeof BabelTypes;

  constructor({
    babelTypes,
    moduleName,
    path,
  }: {
    babelTypes: typeof BabelTypes;
    moduleName: JSModuleNameType;
    path: NodePath;
  }) {
    this.moduleName = moduleName;
    this.node = path.node;
    this.path = path;
    this.t = babelTypes;
  }

  static create({
    babelTypes,
    path,
  }: {
    babelTypes: typeof BabelTypes;
    path: NodePath;
  }): FbtCommonFunctionCallProcessor | null | undefined {
    const nodeChecker = FbtNodeChecker.forFbtCommonFunctionCall(path.node);
    return nodeChecker != null
      ? new FbtCommonFunctionCallProcessor({
          babelTypes,
          moduleName: nodeChecker.moduleName,
          path,
        })
      : null;
  }

  /**
   * Converts an Fbt common call of the form `fbt.c(text)` to the basic form `fbt(text, desc)`
   */
  convertToNormalCall(): CallExpression {
    const { moduleName, node, t } = this;
    if (node.arguments.length !== 1) {
      throw errorAt(
        node,
        `Expected ${moduleName}.c to have exactly 1 argument. ${node.arguments.length} was given.`
      );
    }

    const text = normalizeSpaces(
      expandStringConcat(moduleName, node.arguments[0]).value
    ).trim();

    const desc = getDesc(text);
    if (desc == null || desc === '') {
      throw errorAt(node, getUnknownCommonStringErrorMessage(moduleName, text));
    }

    const callNode = t.callExpression(t.identifier(moduleName), [
      t.stringLiteral(text),
      t.stringLiteral(desc),
      t.objectExpression([
        t.objectProperty(t.identifier(CommonOption), t.booleanLiteral(true)),
      ]),
    ]);

    callNode.loc = node.loc;
    return callNode;
  }
}
