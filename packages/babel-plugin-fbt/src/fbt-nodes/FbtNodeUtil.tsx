import { Node } from '@babel/types';
import invariant from 'invariant';
import type { JSModuleNameType } from '../FbtConstants.tsx';
import { errorAt, normalizeSpaces, varDump } from '../FbtUtil.tsx';
import type { TokenAliases } from '../index.tsx';
import type { StringVariationArgsMap } from './FbtArguments.tsx';
import FbtElementNode from './FbtElementNode.tsx';
import type FbtImplicitParamNodeType from './FbtImplicitParamNode.tsx';
import FbtImplicitParamNode from './FbtImplicitParamNode.tsx';
import type { AnyFbtNode, FbtChildNode, PlainFbtNode } from './FbtNode.tsx';
/**
 * This function gets the mapping from a `FbtSameParamNode`'s token name to
 * the `FbtNode` that shares the same token name.
 * This function also performs token name validation and throws if:
 *     some fbt nodes in the tree have duplicate token names
 *        OR
 *     some `FbtSameParamNode` nodes refer to non-existent token names
 *
 * For example, this function will return
 *    {
 *      "paramToken" => FbtParamNode // which represents <fbt:param name="tokenName">{a}</fbt:param>
 *      "nameToken" => FbtNameNode // which represents <fbt:name name="tokenName2">{name}</fbt:name>
 *    }
 * for the following fbt callsite
 *    <fbt>
 *      <fbt:param name="paramToken">{a}</fbt:param>
 *      {','}
 *      <fbt:sameParam name="paramToken" />
 *      {','}
 *      <fbt:name name="nameToken">{name}</fbt:name>
 *      and finally
 *      <fbt:sameParam name="nameToken" />
 *    </fbt>
 */
import FbtSameParamNode from './FbtSameParamNode.tsx';

export type FromBabelNodeFunctionArgs = {
  moduleName: JSModuleNameType;
  node: Node;
};

/**
 * Returns the closest ancestor node of type: FbtElementNode | FbtImplicitParamNode
 */
export function getClosestElementOrImplicitParamNodeAncestor(
  startNode: AnyFbtNode
): FbtElementNode | FbtImplicitParamNodeType {
  const ret =
    startNode.getFirstAncestorOfType(FbtImplicitParamNode) ||
    startNode.getFirstAncestorOfType(FbtElementNode);
  invariant(
    ret != null,
    'Unable to find closest ancestor of type FbtElementNode or FbtImplicitParamNode for node: %s',
    varDump(startNode)
  );
  return ret;
}

export function runOnNestedChildren(
  node: AnyFbtNode,
  callback: (node: AnyFbtNode) => void
) {
  for (const child of node.children) {
    if (child) {
      callback(child);
      if (child.children.length) {
        runOnNestedChildren(child, callback);
      }
    }
  }
}

export function toPlainFbtNodeTree(
  fbtNode: AnyFbtNode,
  phraseToIndexMap: Map<AnyFbtNode, number>
): PlainFbtNode {
  const node = { ...fbtNode.toPlainFbtNode() };
  const phraseIndex = phraseToIndexMap.get(fbtNode);
  const children = fbtNode.children
    .map((child) =>
      child != null ? toPlainFbtNodeTree(child, phraseToIndexMap) : null
    )
    .filter((child): child is PlainFbtNode => child != null);

  if (children?.length) {
    node.children = children;
  }

  if (phraseIndex != null) {
    node.phraseIndex = phraseIndex;
  }

  return node;
}

/**
 * Convert input text to a token name.
 *
 * It's using a naive way to replace curly brackets present inside the text to square brackets.
 *
 * It's good enough for now because we currently:
 *   - don't protect/encode curly brackets provided in the source text
 *   - don't prevent token names to contain curly brackets from userland
 *
 * @example `convertToTokenName('Hello {name}') === '=Hello [name]'`
 */
export function convertToTokenName(text: string): string {
  return `=${text.replaceAll(/[{}]/g, (m) => (m === '{' ? '[' : ']'))}`;
}

export function tokenNameToTextPattern(tokenName: string): string {
  return `{${tokenName}}`;
}

/**
 * We define an FbtImplicitParamNode's outer token alias to be
 * string concatenation of '=m' + the FbtImplicitParamNode's index in its siblings array.
 *
 * @example For string <fbt> hello <a>world</a></fbt>,
 *          the outer token alias of <a>world</a> will be '=m1'.
 */
export function convertIndexInSiblingsArrayToOuterTokenAlias(
  index: number
): string {
  return convertToTokenName(`m${index}`);
}

/**
 * Collect and normalize text output from a tree of fbt nodes.
 * @param subject Babel node of the subject's gender of the sentence
 * @param getChildNodeText Callback responsible for returning the text of an FbtChildNode
 */
export function getTextFromFbtNodeTree(
  instance: FbtElementNode | FbtImplicitParamNodeType,
  argsMap: StringVariationArgsMap,
  subject: Node | null | undefined,
  preserveWhitespace: boolean,
  getChildNodeText: (
    argsMap: StringVariationArgsMap,
    child: FbtChildNode
  ) => string
): string {
  try {
    if (subject) {
      argsMap.get(instance);
    }
    const texts = instance.children.map(getChildNodeText.bind(null, argsMap));
    return normalizeSpaces(texts.join(''), { preserveWhitespace }).trim();
  } catch (error) {
    throw errorAt(instance.node, error);
  }
}

export function getChildNodeText(
  argsMap: StringVariationArgsMap,
  child: FbtChildNode
): string {
  return child instanceof FbtImplicitParamNode
    ? tokenNameToTextPattern(child.getTokenName(argsMap))
    : child.getText(argsMap);
}

export function getTokenAliasesFromFbtNodeTree(
  instance: FbtElementNode | FbtImplicitParamNodeType,
  argsMap: StringVariationArgsMap
): TokenAliases | null {
  const childrentokenAliases = instance.children.map((node, tokenIndex) =>
    getChildNodeTokenAliases(argsMap, node, tokenIndex)
  );
  const tokenAliases = Object.assign({}, ...childrentokenAliases);
  return Object.keys(tokenAliases).length ? tokenAliases : null;
}

function getChildNodeTokenAliases(
  argsMap: StringVariationArgsMap,
  child: FbtChildNode,
  tokenIndex: number
): TokenAliases {
  if (child instanceof FbtImplicitParamNode) {
    const childToken = child.getTokenName(argsMap);
    invariant(
      childToken != null,
      'The token of FbtImplicitParamNode %s is expected to be non-null',
      varDump(child)
    );
    return {
      [childToken]: convertIndexInSiblingsArrayToOuterTokenAlias(tokenIndex),
    };
  }
  return {};
}

export function getChildNodeTextForDescription(
  targetFbtNode: FbtImplicitParamNodeType,
  argsMap: StringVariationArgsMap,
  child: FbtChildNode
): string {
  if (child instanceof FbtImplicitParamNode) {
    return child === targetFbtNode || !child.isAncestorOf(targetFbtNode)
      ? tokenNameToTextPattern(child.getTokenName(argsMap))
      : child.getTextForDescription(argsMap, targetFbtNode);
  } else {
    return child.getText(argsMap);
  }
}

export function buildFbtNodeMapForSameParam(
  fbtNode: FbtElementNode,
  argsMap: StringVariationArgsMap
): {
  [key: string]: FbtChildNode;
} {
  // Importing this module only here to avoid dependency cycle
  const tokenNameToFbtNode: Record<string, FbtChildNode> = {};
  const tokenNameToSameParamNode: {
    [key: string]: FbtSameParamNode;
  } = {};
  runOnNestedChildren(fbtNode, (child) => {
    if (child instanceof FbtSameParamNode) {
      tokenNameToSameParamNode[child.getTokenName(argsMap)] = child;
      return;
    } else if (
      // FbtImplicitParamNode token names appear redundant but
      // they'll be deduplicated via the token name mangling logic
      child instanceof FbtImplicitParamNode
    ) {
      return;
    }
    const tokenName = child.getTokenName(argsMap);
    if (tokenName != null) {
      const existingFbtNode = tokenNameToFbtNode[tokenName];
      invariant(
        existingFbtNode == null || existingFbtNode === child,
        "There's already a token called `%s` in this %s call. " +
          'Use %s.sameParam if you want to reuse the same token name or ' +
          'give this token a different name.\n' +
          'Existing FbtNode=%s\n' +
          'Redundant FbtNode=%s',
        tokenName,
        fbtNode.moduleName,
        fbtNode.moduleName,
        varDump(existingFbtNode),
        varDump(child)
      );
      tokenNameToFbtNode[tokenName] = child as FbtChildNode;
    }
  });

  const sameParamTokenNameToRealFbtNode: Record<string, FbtChildNode> = {};
  for (const sameParamTokenName of Object.keys(tokenNameToSameParamNode)) {
    const realFbtNode = tokenNameToFbtNode[sameParamTokenName];
    invariant(
      realFbtNode != null,
      'Expected fbt `sameParam` construct with name=`%s` to refer to a ' +
        '`name` or `param` construct using the same token name',
      sameParamTokenName
    );
    sameParamTokenNameToRealFbtNode[sameParamTokenName] = realFbtNode;
  }
  return sameParamTokenNameToRealFbtNode;
}
