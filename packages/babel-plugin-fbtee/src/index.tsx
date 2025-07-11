import type { NodePath } from '@babel/core';
import {
  CallExpression,
  ImportDeclaration,
  JSXElement,
  Node,
} from '@babel/types';
import { parse as parseDocblock } from 'jest-docblock';
import FbtCommonFunctionCallProcessor from './babel-processors/FbtCommonFunctionCallProcessor.tsx';
import type { MetaPhrase } from './babel-processors/FbtFunctionCallProcessor.tsx';
import FbtFunctionCallProcessor from './babel-processors/FbtFunctionCallProcessor.tsx';
import JSXFbtProcessor from './babel-processors/JSXFbtProcessor.tsx';
import FbtElementNode from './fbt-nodes/FbtElementNode.tsx';
import type { AnyFbtNode, PlainFbtNode } from './fbt-nodes/FbtNode.tsx';
import { toPlainFbtNodeTree } from './fbt-nodes/FbtNodeUtil.tsx';
import type { FbtCommonMap } from './FbtCommon.tsx';
import { init } from './FbtCommon.tsx';
import type { FbtCallSiteOptions, FbtOptionConfig } from './FbtConstants.tsx';
import { ValidFbtOptions } from './FbtConstants.tsx';
import type { EnumManifest } from './FbtEnumRegistrar.tsx';
import FbtEnumRegistrar from './FbtEnumRegistrar.tsx';
import FbtNodeChecker from './FbtNodeChecker.tsx';
import { checkOption, errorAt } from './FbtUtil.tsx';
import { FbtVariationType } from './translate/IntlVariations.tsx';
import type { FbtTableKey, PatternHash, PatternString } from './Types.ts';

export { default as fbtHashKey } from './fbtHashKey.tsx';
export { default as replaceClearTokensWithTokenAliases } from './replaceClearTokensWithTokenAliases.tsx';
export { mapLeaves } from './JSFbtUtil.tsx';
export { ModuleName, BindingNames } from './FbtConstants.tsx';
export { SENTINEL } from './FbtConstants.tsx';
export type { FbtTableKey, PatternHash, PatternString };
export type { TranslationGroup } from './bin/translateUtils.tsx';

const isRequireCall = (node: CallExpression) =>
  node.type === 'CallExpression' &&
  node.callee.type === 'Identifier' &&
  node.callee.name === 'require' &&
  node.arguments.length === 1 &&
  node.arguments[0].type === 'StringLiteral';

const isRequireAlias = (path: NodePath<Node>) => {
  const grandParent = path.parentPath?.parent;
  const parent = path.parent;
  const node = path.node;

  return (
    grandParent?.type === 'Program' &&
    parent.type === 'VariableDeclaration' &&
    node.type === 'VariableDeclarator' &&
    node.id.type === 'Identifier' &&
    node.init &&
    node.init.type === 'CallExpression' &&
    isRequireCall(node.init)
  );
};

export type PluginOptions = {
  collectFbt?: boolean;
  // Map of extra fbt options (or JSX attributes) to accept on fbt callsites.
  // We will only accept them at the parsing phase and output them when rendering fbt._() callsites,
  // without doing any further processing on them.
  // We only accept plain string literals as option values at the moment.
  extraOptions: FbtOptionConfig;
  fbtBase64?: boolean;
  fbtCommon?: FbtCommonMap | null;
  // Function that would return an fbt manifest object
  fbtEnumManifest?: EnumManifest | null;
  // @deprecated
  fbtEnumPath?: never;
  // @deprecated
  fbtEnumToPath?: never;
  filename?: string | null;
  // If true, generate the `outerTokenName` property on the JSFbt tree leaves.
  generateOuterTokenName?: boolean;
};
/**
 * Token alias (aka mangled token name)
 */
type TokenAlias = string;
/**
 * Dictionary of clear token names to aliases (aka mangled token names)
 */
export type TokenAliases = {
  [clearTokenName: string]: TokenAlias;
};

/**
 * This is the main payload collected from the fbt callsite.
 *
 * - For simple fbt calls without interpolation (fbt.param) or multiplexing (fbt.plural,
 *   fbt.enum, viewer context variation, etc), this is a simple TableJSFBTTreeLeaf object.
 * - Otherwise this is a tree structure whose keys correspond to the associated string variation
 *   parameters passed to the various fbt constructs (param, plural, pronoun) of this callsite;
 *   and tree leaves are TableJSFBTTreeLeaf objects.
 */
export type TableJSFBTTreeLeaf = {
  desc: string;
  hash?: PatternHash;
  // The token name (at the outer string level) referring to this inner string
  //
  // E.g. For the fbt string `<fbt>Hello <i>World</i></fbt>`,
  // the outer string is "Hello {=World}", and the inner string is: "World".
  // So the outer token name of the inner string will be "=World"
  outerTokenName?: string;
  text: PatternString;
  tokenAliases?: TokenAliases;
};

export type TableJSFBTTreeBranch = {
  [K in FbtTableKey]?: TableJSFBTTree;
};
export type TableJSFBTTree = TableJSFBTTreeLeaf | TableJSFBTTreeBranch;

// Describes the usage of one level of the JSFBT table tree
export type JSFBTMetaEntry = Readonly<
  | {
      range?: undefined;
      singular?: true;
      token?: string;
      type: (typeof FbtVariationType)['NUMBER'];
    }
  | {
      range?: undefined;
      token: string;
      type: (typeof FbtVariationType)['GENDER'];
    }
  | {
      range?: undefined;
      token?: undefined;
      type: (typeof FbtVariationType)['PRONOUN'];
    }
  | {
      range: ReadonlyArray<string>;
      token?: undefined;
      type?: undefined;
    }
>;
export type TableJSFBT = Readonly<{
  m: ReadonlyArray<JSFBTMetaEntry | null | undefined>;
  t: Readonly<TableJSFBTTree>;
}>;
export type ObjectWithJSFBT = {
  jsfbt: TableJSFBT;
};
export type Phrase = FbtCallSiteOptions & {
  filename: string | null;
  loc:
    | {
        end: {
          column: number;
          line: number;
        };
        start: {
          column: number;
          line: number;
        };
      }
    | null
    | undefined;
  project: string;
} & ObjectWithJSFBT;

type ChildToParentMap = Map<number, number>;

/**
 * Default options passed from a docblock.
 */
let defaultOptions: FbtCallSiteOptions;

/**
 * Non-native fbt options that we accept and pass to fbt._() calls
 */
let validFbtExtraOptions: Readonly<FbtOptionConfig>;

/**
 * An array containing all collected phrases.
 */
let allMetaPhrases: Array<
  MetaPhrase & {
    phrase: Phrase;
  }
>;

/**
 * An array containing the child to parent relationships for implicit nodes.
 */
let childToParent: ChildToParentMap;

type Visitor = {
  file: { ast: { comments: ReadonlyArray<{ value: string }> }; code: string };
  opts: PluginOptions;
};

const toVisitor = (visitor: unknown): visitor is Visitor => true;

export default function transform() {
  return {
    name: 'fbtee',

    pre() {
      const visitor = toVisitor(this) ? this : null;
      if (!visitor) {
        return;
      }

      const pluginOptions: PluginOptions | undefined = visitor.opts;
      init(pluginOptions);
      FbtEnumRegistrar.setEnumManifest(getEnumManifest(pluginOptions));
      validFbtExtraOptions = pluginOptions.extraOptions || {};
      initDefaultOptions(visitor);
      allMetaPhrases = [];
      childToParent = new Map();
    },
    visitor: {
      /**
       * Transform fbt("text", "desc", {project: "project"}) to semantically:
       *
       * fbt._(
       *   SENTINEL +
       *   JSON.stringify({
       *     jsfbt: {
       *      text: "text",
       *      desc: "desc",
       *     },
       *     project: "project",
       *   }) +
       *   SENTINEL
       * );
       */
      CallExpression(path: NodePath<CallExpression>) {
        const visitor = toVisitor(this) ? this : null;
        if (!visitor) {
          return null;
        }

        const fileSource = visitor.file.code;
        const pluginOptions: PluginOptions = visitor.opts;

        const root = FbtCommonFunctionCallProcessor.create({
          path,
        });

        if (root) {
          path.replaceWith(root.convertToNormalCall());
          return;
        }

        if (isRequireAlias(path.parentPath)) {
          FbtEnumRegistrar.registerRequireIfApplicable(path);
          return;
        }

        const processor = FbtFunctionCallProcessor.create({
          defaultFbtOptions: defaultOptions,
          fileSource,
          path,
          pluginOptions,
          validFbtExtraOptions,
        });

        if (!processor) {
          return;
        }

        processor.throwIfExistsNestedFbtConstruct();

        const { callNode, metaPhrases } = processor.convertToFbtRuntimeCall();
        path.replaceWith(callNode);

        if (pluginOptions.collectFbt) {
          const initialPhraseCount = allMetaPhrases.length;
          metaPhrases.forEach((metaPhrase, index) => {
            if (metaPhrase.phrase.doNotExtract) {
              return;
            }
            addMetaPhrase(metaPhrase, pluginOptions);

            if (metaPhrase.parentIndex != null) {
              childToParent.set(
                index + initialPhraseCount,
                metaPhrase.parentIndex + initialPhraseCount,
              );
            }
          });
        }
      },

      /**
       * Register enum imports
       */
      ImportDeclaration(path: NodePath<ImportDeclaration>) {
        FbtEnumRegistrar.registerImportIfApplicable(path);
      },

      /**
       * Transform jsx-style <fbt> to fbt() calls.
       */
      JSXElement(path: NodePath<JSXElement>) {
        const root = JSXFbtProcessor.create({
          path,
          validFbtExtraOptions,
        });

        if (!root) {
          return;
        }
        root.convertToFbtFunctionCallNode(allMetaPhrases.length);
      },

      Program: {
        exit(path: NodePath<Node>) {
          path.traverse({
            CallExpression(path: NodePath<CallExpression>) {
              if (
                FbtNodeChecker.getFbtNodeTypeFromFunctionCall(path.node) != null
              ) {
                throw errorAt(
                  path.node,
                  `fbt constructs must be used within the scope of other fbt constructs.`,
                );
              }
            },
          });
        },
      },
    },
  };
}

function initDefaultOptions(state: {
  file: { ast: { comments: ReadonlyArray<{ value: string }> } };
}) {
  defaultOptions = {};
  const comment = state.file.ast.comments[0];
  const docblock = (comment && comment.value) || '';
  const fbtDocblockOptions = parseDocblock(docblock).fbt;
  if (fbtDocblockOptions && typeof fbtDocblockOptions === 'string') {
    defaultOptions = JSON.parse(fbtDocblockOptions);
    Object.keys(defaultOptions).forEach((o) => checkOption(o, ValidFbtOptions));
  }
  if (!defaultOptions.project) {
    defaultOptions.project = '';
  }
}

function addMetaPhrase(metaPhrase: MetaPhrase, pluginOptions: PluginOptions) {
  const { fbtNode } = metaPhrase;
  allMetaPhrases.push({
    ...metaPhrase,
    phrase: {
      filename: pluginOptions.filename || null,
      loc: fbtNode.node.loc,
      project: metaPhrase.phrase.project || '',
      ...metaPhrase.phrase,
    },
  });
}

function getEnumManifest(opts: PluginOptions): EnumManifest | null {
  const { fbtEnumManifest, fbtEnumPath, fbtEnumToPath } = opts;
  if (fbtEnumManifest != null) {
    return fbtEnumManifest;
  } else if (fbtEnumPath != null) {
    throw new Error(
      `'fbtEnumPath' is no longer supported. Use 'fbtEnumManifest' instead.`,
    );
  } else if (fbtEnumToPath != null) {
    throw new Error(
      `'fbtEnumToPath' is no longer supported. Use 'fbtEnumManifest' instead.`,
    );
  }
  return null;
}

export function getExtractedStrings(): Array<Phrase> {
  return allMetaPhrases.map((metaPhrase) => metaPhrase.phrase);
}

export function getChildToParentRelationships(): ChildToParentMap {
  return childToParent;
}

export function getFbtElementNodes(): Array<PlainFbtNode> {
  const phraseToIndexMap = new Map<AnyFbtNode, number>(
    allMetaPhrases.map((metaPhrase, index) => [metaPhrase.fbtNode, index]),
  );

  return allMetaPhrases
    .map(({ fbtNode }) =>
      fbtNode instanceof FbtElementNode
        ? toPlainFbtNodeTree(fbtNode, phraseToIndexMap)
        : null,
    )
    .filter((node): node is PlainFbtNode => node != null);
}
