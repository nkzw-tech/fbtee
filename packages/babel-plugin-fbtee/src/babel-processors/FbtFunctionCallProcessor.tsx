import { Buffer } from 'node:buffer';
import type { NodePath } from '@babel/core';
import {
  ArgumentPlaceholder,
  arrayExpression,
  assignmentExpression,
  BlockStatement,
  CallExpression,
  callExpression,
  cloneNode,
  Expression,
  Identifier,
  identifier,
  isBlockStatement,
  isProgram,
  jsxExpressionContainer,
  memberExpression,
  Node,
  Program,
  SequenceExpression,
  sequenceExpression,
  SpreadElement,
  stringLiteral,
  variableDeclaration,
  variableDeclarator,
} from '@babel/types';
import invariant from 'invariant';
import type { AnyStringVariationArg } from '../fbt-nodes/FbtArguments.tsx';
import { StringVariationArgsMap } from '../fbt-nodes/FbtArguments.tsx';
import FbtElementNode from '../fbt-nodes/FbtElementNode.tsx';
import FbtImplicitParamNode from '../fbt-nodes/FbtImplicitParamNode.tsx';
import type { AnyFbtNode } from '../fbt-nodes/FbtNode.tsx';
import { isConcreteFbtNode } from '../fbt-nodes/FbtNodeType.tsx';
import FbtParamNode from '../fbt-nodes/FbtParamNode.tsx';
import type {
  BindingName,
  FbtCallSiteOptions,
  FbtOptionConfig,
} from '../FbtConstants.tsx';
import { SENTINEL } from '../FbtConstants.tsx';
import FbtNodeChecker from '../FbtNodeChecker.tsx';
import {
  convertToStringArrayNodeIfNeeded,
  createRuntimeCallExpression,
  enforceBoolean,
  enforceString,
  errorAt,
  varDump,
} from '../FbtUtil.tsx';
import type {
  ObjectWithJSFBT,
  PluginOptions,
  TableJSFBTTree,
  TableJSFBTTreeLeaf,
} from '../index.tsx';
import JSFbtBuilder from '../JSFbtBuilder.tsx';
import nullthrows from '../nullthrows.tsx';
import addLeafToTree from '../utils/addLeafToTree.tsx';

type CallExpressionPath = NodePath<CallExpression>;

export type FbtFunctionCallPhrase = FbtCallSiteOptions & ObjectWithJSFBT;

export type SentinelPayload = ObjectWithJSFBT & {
  project: string;
};

export type MetaPhrase = {
  compactStringVariations: CompactStringVariations;
  // FbtNode abstraction whose phrase's data comes from
  fbtNode: FbtElementNode | FbtImplicitParamNode;
  // Index of the outer-phrase (assuming that the current phrase is an inner-phrase)
  // If the current phrase is the top-level phrase, it won't be defined.
  parentIndex: number | null;
  // Phrase data
  phrase: FbtFunctionCallPhrase;
};

type CompactStringVariations = {
  // Compacted string variation argument list
  array: ReadonlyArray<AnyStringVariationArg>;
  // Mapping of the original item indexes so that:
  //   For the output array item at index `k`, the original SVArgument index is `indexMap[k]`
  indexMap: ReadonlyArray<number>;
};

// In the final fbt runtime call, runtime arguments that create string variation
// will become identifiers(references to local variables) if there exist string variations
// AND inner strings.
type StringVariationRuntimeArgumentNodes =
  | Array<Identifier>
  | Array<CallExpression>;

const emptyArgsCombinations: [[]] = [[]];
const STRING_VARIATION_RUNTIME_ARGUMENT_IDENTIFIER_PREFIX = 'fbt_sv_arg';

/**
 * This class provides utility methods to process the node of the standard fbt function call
 * (i.e. `fbt(...)`)
 */
export default class FbtFunctionCallProcessor {
  defaultFbtOptions: FbtCallSiteOptions;
  validFbtExtraOptions: Readonly<FbtOptionConfig>;
  fileSource: string;
  moduleName: BindingName;
  node: CallExpressionPath['node'];
  nodeChecker: FbtNodeChecker;
  path: CallExpressionPath;
  pluginOptions: PluginOptions;

  constructor({
    defaultFbtOptions,
    fileSource,
    nodeChecker,
    path,
    pluginOptions,
    validFbtExtraOptions,
  }: {
    defaultFbtOptions: FbtCallSiteOptions;
    fileSource: string;
    nodeChecker: FbtNodeChecker;
    path: CallExpressionPath;
    pluginOptions: PluginOptions;
    validFbtExtraOptions: Readonly<FbtOptionConfig>;
  }) {
    this.defaultFbtOptions = defaultFbtOptions;
    this.validFbtExtraOptions = validFbtExtraOptions;
    this.fileSource = fileSource;
    this.moduleName = nodeChecker.moduleName;
    this.node = path.node;
    this.nodeChecker = nodeChecker;
    this.path = path;
    this.pluginOptions = pluginOptions;
  }

  static create({
    defaultFbtOptions,
    fileSource,
    path,
    pluginOptions,
    validFbtExtraOptions,
  }: {
    defaultFbtOptions: FbtCallSiteOptions;
    fileSource: string;
    path: CallExpressionPath;
    pluginOptions: PluginOptions;
    validFbtExtraOptions: Readonly<FbtOptionConfig>;
  }): FbtFunctionCallProcessor | null {
    const nodeChecker = FbtNodeChecker.forFbtFunctionCall(path.node);
    return nodeChecker != null
      ? new FbtFunctionCallProcessor({
          defaultFbtOptions,
          fileSource,
          nodeChecker,
          path,
          pluginOptions,
          validFbtExtraOptions,
        })
      : null;
  }

  _assertJSModuleWasAlreadyRequired(): this {
    const { moduleName, path } = this;
    if (!this.nodeChecker.isJSModuleBound<typeof path.node>(path)) {
      throw errorAt(
        path.node,
        `${moduleName} is not bound. Did you forget to import ${moduleName}?`,
      );
    }
    return this;
  }

  _assertHasEnoughArguments(): this {
    const { moduleName, node } = this;
    if (node.arguments.length < 2) {
      throw errorAt(
        node,
        `Expected ${moduleName} calls to have at least two arguments. ` +
          `Only ${node.arguments.length} was given.`,
      );
    }
    return this;
  }

  _createFbtRuntimeCallForMetaPhrase(
    metaPhrases: ReadonlyArray<MetaPhrase>,
    metaPhraseIndex: number,
    stringVariationRuntimeArgs: StringVariationRuntimeArgumentNodes,
  ): CallExpression {
    const { phrase } = metaPhrases[metaPhraseIndex];
    const { pluginOptions } = this;

    // 1st argument - Sentinel Payload
    const argsOutput = JSON.stringify({
      jsfbt: phrase.jsfbt,
      project: phrase.project,
    } as SentinelPayload);
    const encodedOutput =
      pluginOptions.fbtBase64 === true
        ? Buffer.from(argsOutput).toString('base64')
        : argsOutput;
    const args: Array<Expression | SpreadElement | ArgumentPlaceholder> = [
      stringLiteral(SENTINEL + encodedOutput + SENTINEL),
    ];

    // 2nd argument - `FbtTableArgs` in the fbt runtime calls
    const fbtRuntimeArgs = this._createFbtRuntimeArgumentsForMetaPhrase(
      metaPhrases,
      metaPhraseIndex,
      stringVariationRuntimeArgs,
    );
    if (fbtRuntimeArgs.length > 0) {
      args.push(arrayExpression(fbtRuntimeArgs));
    }

    return callExpression(
      memberExpression(identifier(this.moduleName), identifier('_')),
      args,
    );
  }

  _createRootFbtRuntimeCall(
    metaPhrases: ReadonlyArray<MetaPhrase>,
  ): CallExpression | SequenceExpression {
    const stringVariationRuntimeArgs =
      this._createRuntimeArgsFromStringVariantNodes(metaPhrases[0]);
    if (!this._hasStringVariationAndContainsInnerString(metaPhrases)) {
      return this._createFbtRuntimeCallForMetaPhrase(
        metaPhrases,
        0,
        stringVariationRuntimeArgs,
      );
    }
    this._throwIfStringVariationArgsMayCauseSideEffects(metaPhrases);

    const stringVariationRuntimeArgIdentifiers =
      this._generateUniqueIdentifiersForRuntimeArgs(
        stringVariationRuntimeArgs.length,
      );
    const fbtRuntimeCall = this._createFbtRuntimeCallForMetaPhrase(
      metaPhrases,
      0,
      stringVariationRuntimeArgIdentifiers,
    );
    this._injectVariableDeclarationsForStringVariationArguments(
      stringVariationRuntimeArgIdentifiers,
    );
    return this._wrapFbtRuntimeCallInSequenceExpression(
      stringVariationRuntimeArgs,
      fbtRuntimeCall,
      stringVariationRuntimeArgIdentifiers,
    );
  }

  /**
   * String variation arguments are not allowed to contain anything that may
   * cause side-effects. Side-effects are mostly introduced by but not limited to
   * method calls and class instantiations. Please refer to the JSDoc of
   * FbtNode#throwIfAnyArgumentContainsFunctionCallOrClassInstantiation for
   * examples.
   */
  _throwIfStringVariationArgsMayCauseSideEffects(
    metaPhrases: ReadonlyArray<MetaPhrase>,
  ) {
    metaPhrases[0].compactStringVariations.array.map((svArg) =>
      svArg.fbtNode.throwIfAnyArgumentContainsFunctionCallOrClassInstantiation(
        this.path.context.scope,
      ),
    );
  }

  _injectVariableDeclarationsForStringVariationArguments(
    identifiersForStringVariationRuntimeArgs: ReadonlyArray<Identifier>,
  ) {
    // Find the first ancestor block statement node or the program root node
    let curPath: NodePath<Node> = this.path;
    while (!isBlockStatement(curPath.node) && !isProgram(curPath.node)) {
      curPath = nullthrows(
        curPath.parentPath,
        'curPath can not be null. Otherwise, it means we reached the root' +
          ' of Babel AST in the previous iteration and therefore we would have exited the loop.',
      );
    }
    const blockOrProgramPath = curPath;
    const blockOrProgramNode = blockOrProgramPath.node;
    invariant(
      isBlockStatement(blockOrProgramNode) || isProgram(blockOrProgramNode),
      "According to the above loop's condition, " +
        'blockOrProgramNode must be either a block statement or a program node ',
    );

    // Replace the blockStatement/program node with
    // a new blockStatement/program with injected declarations
    const declarations = variableDeclaration(
      'var',
      identifiersForStringVariationRuntimeArgs.map((identifier) =>
        variableDeclarator(identifier),
      ),
    );
    const cloned = cloneNode<BlockStatement | Program>(
      blockOrProgramNode,
      false,
    );
    cloned.body = [declarations, ...cloned.body];
    blockOrProgramPath.replaceWith(cloned);
  }

  /**
   * Pre-assign those arguments that create string variations to local variables,
   * and use references to these variables in fbt call. Note: Local variables
   * will be auto-declared in sequenceExpression.
   *
   * E.g.
   * Before:
   *   fbt._()
   *
   * After:
   *   (identifier_0 = runtimeArg1, identifier_1 = runtimeArg2, fbt._())
   */
  _wrapFbtRuntimeCallInSequenceExpression(
    runtimeArgs: ReadonlyArray<CallExpression>,
    fbtRuntimeCall: CallExpression,
    identifiersForStringVariationRuntimeArgs: ReadonlyArray<Identifier>,
  ): SequenceExpression {
    invariant(
      runtimeArgs.length == identifiersForStringVariationRuntimeArgs.length,
      'Expect exactly one identifier for each string variation runtime argument. ' +
        'Instead we get %s identifiers and %s arguments.',
      identifiersForStringVariationRuntimeArgs.length,
      runtimeArgs.length,
    );
    return sequenceExpression([
      ...runtimeArgs.map((runtimeArg, i) =>
        assignmentExpression(
          '=',
          identifiersForStringVariationRuntimeArgs[i],
          runtimeArg,
        ),
      ),
      fbtRuntimeCall,
    ]);
  }

  _hasStringVariationAndContainsInnerString(
    metaPhrases: ReadonlyArray<MetaPhrase>,
  ): boolean {
    const fbtElement = metaPhrases[0].fbtNode;
    invariant(
      fbtElement instanceof FbtElementNode,
      'Expected a FbtElementNode for top level string but received: %s',
      varDump(fbtElement),
    );
    const doesNotContainInnerString = fbtElement.children.every((child) => {
      return !(child instanceof FbtImplicitParamNode);
    });
    if (doesNotContainInnerString) {
      return false;
    }

    return metaPhrases[0].compactStringVariations.array.length > 0;
  }

  _generateUniqueIdentifiersForRuntimeArgs(count: number): Array<Identifier> {
    const identifiers = [];
    for (
      let identifierSuffix = 0, numIdentifierCreated = 0;
      numIdentifierCreated < count;
      identifierSuffix++
    ) {
      const name = `${STRING_VARIATION_RUNTIME_ARGUMENT_IDENTIFIER_PREFIX}_${identifierSuffix}`;
      if (this.path.context.scope.getBinding(name) == null) {
        identifiers.push(identifier(name));
        numIdentifierCreated++;
      }
    }
    return identifiers;
  }

  /**
   * Consolidate a list of string variation arguments under the following conditions:
   *
   * Enum variation arguments are consolidated to avoid creating duplicates of string variations
   * (from a candidate values POV)
   *
   * Other types of variation arguments are accepted as-is.
   */
  _compactStringVariationArgs(
    args: ReadonlyArray<AnyStringVariationArg>,
  ): CompactStringVariations {
    const indexMap: Array<number> = [];
    const array = args.filter((arg, i) => {
      if (arg.isCollapsible) {
        return false;
      }
      indexMap.push(i);
      return true;
    });

    return {
      array,
      indexMap,
    };
  }

  _getPhraseParentIndex(
    fbtNode: AnyFbtNode,
    list: ReadonlyArray<AnyFbtNode>,
  ): number | null {
    if (fbtNode.parent == null) {
      return null;
    }
    const parentIndex = list.indexOf(fbtNode.parent);
    invariant(
      parentIndex > -1,
      'Unable to find parent fbt node: node=%s',
      varDump(fbtNode),
    );
    return parentIndex;
  }

  /**
   * Generates a list of meta-phrases from a given FbtElement node
   */
  _metaPhrases(fbtElement: FbtElementNode): ReadonlyArray<MetaPhrase> {
    const stringVariationArgs = fbtElement.getArgsForStringVariationCalc();
    const jsfbtBuilder = new JSFbtBuilder(this.fileSource, stringVariationArgs);
    const argsCombinations = jsfbtBuilder.getStringVariationCombinations();
    const compactStringVariations = this._compactStringVariationArgs(
      argsCombinations[0] || [],
    );
    const jsfbtMetadata = jsfbtBuilder.buildMetadata(
      compactStringVariations.array,
    );
    const sharedPhraseOptions = this._getSharedPhraseOptions(fbtElement);
    return [fbtElement, ...fbtElement.getImplicitParamNodes()].map(
      (fbtNode, _index, list) => {
        try {
          const phrase = {
            ...sharedPhraseOptions,
            jsfbt: {
              m: jsfbtMetadata,
              t: {},
            },
          };
          const svArgsMapList: Array<StringVariationArgsMap> = [];

          (argsCombinations.length
            ? argsCombinations
            : emptyArgsCombinations
          ).forEach((argsCombination) => {
            const svArgsMap = new StringVariationArgsMap(argsCombination);
            const argValues = compactStringVariations.indexMap.map(
              (originIndex) => nullthrows(argsCombination[originIndex]?.value),
            );
            const leaf = {
              desc: fbtNode.getDescription(svArgsMap),
              text: fbtNode.getText(svArgsMap),
            } as TableJSFBTTreeLeaf;

            const tokenAliases = fbtNode.getTokenAliases(svArgsMap);
            if (tokenAliases != null) {
              leaf.tokenAliases = tokenAliases;
            }

            if (fbtNode instanceof FbtElementNode) {
              // gather list of svArgsMap for all args combination for later sanity checks
              svArgsMapList.push(svArgsMap);
            } else if (this.pluginOptions.generateOuterTokenName === true) {
              leaf.outerTokenName = fbtNode.getTokenName(svArgsMap);
            }

            if (argValues.length) {
              addLeafToTree<TableJSFBTTreeLeaf, TableJSFBTTree>(
                phrase.jsfbt.t,
                argValues,
                leaf,
              );
            } else {
              // jsfbt only contains one leaf
              phrase.jsfbt.t = leaf;
            }
          });

          if (fbtNode instanceof FbtElementNode) {
            fbtNode.assertNoOverallTokenNameCollision(svArgsMapList);
          }

          return {
            compactStringVariations,
            fbtNode,
            parentIndex: this._getPhraseParentIndex(fbtNode, list),
            phrase,
          };
        } catch (error) {
          throw errorAt(this.node, error);
        }
      },
    );
  }

  /**
   * Process current `fbt()` callsite (Node) to generate:
   * - an `fbt._()` callsite or a sequencExpression that eventually returns an `fbt._()` callsite
   * - a list of meta-phrases describing the collected text strings from this fbt() callsite
   */
  convertToFbtRuntimeCall(): {
    // Client-side fbt._() call(or the sequencExpression that contains it)
    // usable in a web browser generated from the given fbt() callsite
    callNode: CallExpression | SequenceExpression;
    // List of phrases collected from the fbt() callsite
    metaPhrases: ReadonlyArray<MetaPhrase>;
  } {
    const fbtElement = this._convertToFbtNode();
    const metaPhrases = this._metaPhrases(fbtElement);
    const callNode = this._createRootFbtRuntimeCall(metaPhrases);
    return {
      callNode,
      metaPhrases,
    };
  }

  /**
   * fbt constructs are not allowed to be direct children of fbt constructs.
   * For example it is not okay to have
   *    <fbt desc='desc'>
   *      <fbt:param name="outer">
   *        <fbt:param name="inner">
   *          variable
   *        </fbt:param>
   *      </fbt:param>
   *    </fbt>
   * However, the next example is okay because the inner `fbt:param` sits inside
   * an inner fbt.
   *    <fbt desc='outer string'>
   *      <fbt:param name="outer">
   *        <fbt desc='inner string'>
   *          <fbt:param name="inner">
   *            variable
   *          </fbt:param>
   *        </fbt>
   *      </fbt:param>
   *    </fbt>
   */
  throwIfExistsNestedFbtConstruct() {
    this.path.traverse(
      {
        CallExpression(path: CallExpressionPath) {
          const nodeChecker = this.nodeChecker as FbtNodeChecker;
          const childFbtConstructName = nodeChecker.getFbtNodeType(path.node);
          if (
            !childFbtConstructName ||
            !isConcreteFbtNode(childFbtConstructName)
          ) {
            return;
          }

          let parentPath: NodePath<Node> | null = path.parentPath;
          while (parentPath != null) {
            const parentNode = parentPath.node;
            if (
              FbtNodeChecker.forFbtFunctionCall(parentNode) != null ||
              // children JSX fbt aren't yet converted to function call by JSXFbtProcessor
              FbtNodeChecker.forJSXFbt(parentNode) != null
            ) {
              return;
            }

            const parentFbtConstructName =
              nodeChecker.getFbtNodeType(parentNode);
            if (
              parentFbtConstructName &&
              isConcreteFbtNode(parentFbtConstructName)
            ) {
              throw errorAt(
                parentNode,
                `Expected fbt constructs to not nest inside fbt constructs, ` +
                  `but found ` +
                  `${nodeChecker.moduleName}.${
                    nullthrows(childFbtConstructName) as string
                  } ` +
                  `nest inside ` +
                  `${nodeChecker.moduleName}.${
                    nullthrows(parentFbtConstructName) as string
                  }`,
              );
            }
            parentPath = parentPath.parentPath;
          }
        },
      },
      {
        nodeChecker: this.nodeChecker,
      },
    );
  }

  /**
   * Converts current fbt() Node to an FbtNode equivalent
   */
  _convertToFbtNode(): FbtElementNode {
    this._assertJSModuleWasAlreadyRequired();
    this._assertHasEnoughArguments();

    const { moduleName, node } = this;
    const { arguments: fbtCallArgs } = node;
    const fbtContentsNode = convertToStringArrayNodeIfNeeded(
      moduleName,
      fbtCallArgs[0],
    );
    fbtCallArgs[0] = fbtContentsNode;

    const elementNode = FbtElementNode.fromNode(
      moduleName,
      node,
      this.validFbtExtraOptions,
    );
    if (elementNode == null) {
      throw errorAt(
        node,
        `${moduleName}: unable to create FbtElementNode from given node`,
      );
    }
    return elementNode;
  }

  _createFbtRuntimeArgumentsForMetaPhrase(
    metaPhrases: ReadonlyArray<MetaPhrase>,
    metaPhraseIndex: number,
    stringVariationRuntimeArgs: StringVariationRuntimeArgumentNodes,
  ): Array<CallExpression | Identifier> {
    const metaPhrase = metaPhrases[metaPhraseIndex];
    // Runtime arguments of a string fall into 3 categories:
    // 1. Each string variation argument must correspond to a runtime argument
    // 2. Non string variation arguments(i.e. those fbt.param() calls that do not
    // have gender or number option) should also be counted as runtime arguments.
    // 3. Each inner string of current string should be associated with a
    // runtime argument
    return [
      ...stringVariationRuntimeArgs,
      ...this._createRuntimeArgsFromNonStringVariantNodes(metaPhrase.fbtNode),
      ...this._createRuntimeArgsFromImplicitParamNodes(
        metaPhrases,
        metaPhraseIndex,
        stringVariationRuntimeArgs,
      ),
    ];
  }

  _createRuntimeArgsFromStringVariantNodes(
    metaPhrase: MetaPhrase,
  ): Array<CallExpression> {
    const fbtRuntimeArgs = [];
    const { compactStringVariations } = metaPhrase;
    for (const stringVariation of compactStringVariations.array) {
      const fbtRuntimeArg = stringVariation.fbtNode.getFbtRuntimeArg();
      if (fbtRuntimeArg) {
        fbtRuntimeArgs.push(fbtRuntimeArg);
      }
    }
    return fbtRuntimeArgs;
  }

  _createRuntimeArgsFromNonStringVariantNodes(
    fbtNode: FbtImplicitParamNode | FbtElementNode,
  ): Array<CallExpression> {
    const fbtRuntimeArgs = [];
    for (const child of fbtNode.children) {
      if (
        child instanceof FbtParamNode &&
        child.options.gender == null &&
        child.options.number == null
      ) {
        fbtRuntimeArgs.push(child.getFbtRuntimeArg());
      }
    }
    return fbtRuntimeArgs;
  }

  _createRuntimeArgsFromImplicitParamNodes(
    metaPhrases: ReadonlyArray<MetaPhrase>,
    metaPhraseIndex: number,
    runtimeArgsFromStringVariationNodes: StringVariationRuntimeArgumentNodes,
  ): Array<CallExpression> {
    const fbtRuntimeArgs = [];
    for (const [
      innerMetaPhraseIndex,
      innerMetaPhrase,
    ] of metaPhrases.entries()) {
      if (innerMetaPhrase.parentIndex != metaPhraseIndex) {
        continue;
      }
      const innerMetaPhraseFbtNode = innerMetaPhrase.fbtNode;
      invariant(
        innerMetaPhraseFbtNode instanceof FbtImplicitParamNode,
        'Expected the inner meta phrase to be associated with a FbtImplicitParamNode instead of %s',
        varDump(innerMetaPhraseFbtNode),
      );
      const node = cloneNode(innerMetaPhraseFbtNode.node);
      node.children = [
        jsxExpressionContainer(
          this._createFbtRuntimeCallForMetaPhrase(
            metaPhrases,
            innerMetaPhraseIndex,
            runtimeArgsFromStringVariationNodes,
          ),
        ),
      ];
      const fbtParamRuntimeArg = createRuntimeCallExpression(
        innerMetaPhraseFbtNode,
        [stringLiteral(innerMetaPhraseFbtNode.getOuterTokenAlias()), node],
      );
      fbtRuntimeArgs.push(fbtParamRuntimeArg);
    }
    return fbtRuntimeArgs;
  }

  /**
   * Combine options of the fbt element level with default options
   * @returns only options that are considered "defined".
   * I.e. Options whose value is `false` or nullish will be skipped.
   */
  _getSharedPhraseOptions({ options: fbtElementOptions }: FbtElementNode) {
    const { defaultFbtOptions } = this;

    const author =
      fbtElementOptions.author ??
      enforceString.orNull(defaultFbtOptions.author);
    const common =
      fbtElementOptions.common ??
      enforceBoolean.orNull(defaultFbtOptions.common);
    const doNotExtract =
      fbtElementOptions.doNotExtract ??
      enforceBoolean.orNull(defaultFbtOptions.doNotExtract);
    const preserveWhitespace =
      fbtElementOptions.preserveWhitespace ??
      enforceBoolean.orNull(defaultFbtOptions.preserveWhitespace);
    const project =
      fbtElementOptions.project || enforceString(defaultFbtOptions.project);
    const subject = fbtElementOptions.subject;

    return {
      ...(author != null && { author }),
      ...(common != null && common !== false && { common }),
      ...(doNotExtract != null && doNotExtract !== false && { doNotExtract }),
      ...(preserveWhitespace != null &&
        preserveWhitespace !== false && { preserveWhitespace }),
      ...(subject != null && { subject }),
      project,
    } as const;
  }
}
