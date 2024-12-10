import util from 'node:util';
import generate from '@babel/generator';
import {
  ArgumentPlaceholder,
  ArrayExpression,
  arrayExpression,
  booleanLiteral,
  CallExpression,
  callExpression,
  Expression,
  identifier,
  isArgumentPlaceholder,
  isArrowFunctionExpression,
  isBinaryExpression,
  isBooleanLiteral,
  isCallExpression,
  isExpression,
  isIdentifier,
  isJSXAttribute,
  isJSXElement,
  isJSXEmptyExpression,
  isJSXExpressionContainer,
  isJSXIdentifier,
  isJSXNamespacedName,
  isJSXSpreadAttribute,
  isJSXText,
  isNode,
  isObjectExpression,
  isObjectProperty,
  isSpreadElement,
  isStringLiteral,
  isTemplateLiteral,
  JSXAttribute,
  JSXElement,
  JSXExpressionContainer,
  JSXOpeningElement,
  JSXSpreadAttribute,
  JSXText,
  memberExpression,
  Node,
  objectExpression,
  ObjectExpression,
  ObjectMethod,
  ObjectProperty,
  objectProperty,
  PrivateName,
  SpreadElement,
  StringLiteral,
  stringLiteral,
  TemplateLiteral,
} from '@babel/types';
import invariant from 'invariant';
import nullthrows from 'nullthrows';
import type { AnyFbtNode } from './fbt-nodes/FbtNode';
import type {
  FbtOptionConfig,
  FbtOptionValue,
  FbtOptionValues,
  JSModuleNameType,
} from './FbtConstants';
import { JSModuleName, ModuleNameRegExp } from './FbtConstants';
import type { TokenAliases } from './index';
import type { PatternString } from './Types';

const { hasOwnProperty } = Object.prototype;

type BabelNodeJSXAttributes = ReadonlyArray<
  JSXOpeningElement['attributes'][number]
>;

export type CallExpressionArg =
  | Expression
  | SpreadElement
  | ArgumentPlaceholder;
export type BabelNodeCallExpressionArgument =
  CallExpression['arguments'][number];
export type ParamSet = {
  [parameterName: string]: Node | null | undefined;
};
const { FBS, FBT } = JSModuleName;

export function normalizeSpaces(
  value: string,
  // TODO(T56277500) set better types for Fbt options object to use `preserveWhitespace?: ?boolean`
  options?: {
    preserveWhitespace?: FbtOptionValue | null | undefined;
  } | null
): string {
  if (options && options.preserveWhitespace) {
    return value;
  }
  // We're  willingly preserving non-breaking space characters (\u00A0)
  // See D33402749 for more info.
  return value.replaceAll(/[^\S\u00A0]+/g, ' ');
}

/**
 * Validates the type of fbt construct inside <fbt>.
 * Currently detected:
 *   <fbt:param>, <FbtParam>
 *   <fbt:enum>,  <FbtEnum>
 *   <fbt:name>,  <FbtName>
 *   etc...
 * @param node The node that may be a JSX fbt construct
 * @return Returns the name of a corresponding handler (fbt construct).
 * If a child is not valid, it is flagged as an Implicit Parameter (`implicitParamMarker`)
 */
export function validateNamespacedFbtElement(
  moduleName: string,
  node: Node
): string {
  let valid = false;
  let handlerName;

  // Actual namespaced version, e.g. <fbt:param>
  if (isJSXNamespacedName(node)) {
    handlerName = node.name.name;
    valid =
      isJSXIdentifier(node.namespace) &&
      node.namespace.name === moduleName &&
      (handlerName === 'enum' ||
        handlerName === 'param' ||
        handlerName === 'plural' ||
        handlerName === 'pronoun' ||
        handlerName === 'name' ||
        handlerName === 'same-param');
    // React's version, e.g. <FbtParam>, or <FbtEnum>
  } else if (isJSXIdentifier(node)) {
    handlerName = node.name.slice(3).toLowerCase();
    valid =
      node.name === 'FbtEnum' ||
      node.name === 'FbtParam' ||
      node.name === 'FbtPlural' ||
      node.name === 'FbtPronoun' ||
      node.name === 'FbtName' ||
      node.name === 'FbtSameParam';
  }

  if (!valid) {
    handlerName = 'implicitParamMarker';
  }

  if (handlerName === 'same-param' || handlerName === 'sameparam') {
    handlerName = 'sameParam';
  }

  invariant(handlerName != null, 'handlerName must not be null');
  return handlerName;
}

function isBabelNodeCallExpressionArg(value: Node): value is CallExpressionArg {
  return (
    isExpression(value) ||
    isSpreadElement(value) ||
    isJSXNamespacedName(value) ||
    isArgumentPlaceholder(value)
  );
}

function isTextualNode(node: Node): boolean {
  if (isStringLiteral(node) || isJSXText(node)) {
    return true;
  } else if (isBinaryExpression(node) && node.operator === '+') {
    return isTextualNode(node.left) && isTextualNode(node.right);
  }
  return false;
}

export function setUniqueToken(
  node: Node,
  moduleName: string,
  name: string,
  paramSet: ParamSet
): void {
  const cachedNode = paramSet[name];
  if (cachedNode && cachedNode != node) {
    throw errorAt(
      node,
      `There's already a token called "${name}" in this ${moduleName} call. ` +
        `Use ${moduleName}.sameParam if you want to reuse the same token name or ` +
        `give this token a different name`
    );
  }
  paramSet[name] = node;
}

export function checkOption<K extends string>(
  option: string,
  validOptions: FbtOptionConfig,
  value?: Node | null | undefined | string | boolean
): K {
  const optionName = option as K;

  const validValues = validOptions[optionName];
  if (!hasOwnProperty.call(validOptions, optionName) || validValues == null) {
    throw errorAt(
      isNode(value) ? value : null,
      `Invalid option "${optionName}". ` +
        `Only allowed: ${Object.keys(validOptions).join(', ')} `
    );
  } else if (validValues !== true) {
    let valueStr;
    if (typeof value === 'string' || typeof value === 'boolean') {
      valueStr = value.toString();
    } else if (
      isNode(value) &&
      (isStringLiteral(value) || isBooleanLiteral(value))
    ) {
      valueStr = value && value.value.toString();
    } else {
      throw errorAt(
        isNode(value) ? value : null,
        `Option "${optionName}" has an invalid value. ` +
          `Expected a string literal but value is \`${varDump(
            value
          )}\` (${typeof value})`
      );
    }

    if (!validValues[valueStr]) {
      throw errorAt(
        isNode(value) ? value : null,
        `Option "${optionName}" has an invalid value: "${valueStr}". ` +
          `Only allowed: ${Object.keys(validValues).join(', ')}`
      );
    }
  }
  return optionName;
}

const SHORT_BOOL_CANDIDATES = {
  common: 'common',
  doNotExtract: 'doNotExtract',
  number: 'number',
  preserveWhitespace: 'preserveWhitespace',
} as const;

function canBeShortBoolAttr(name: string) {
  return name in SHORT_BOOL_CANDIDATES;
}

/**
 * Build options list form corresponding attributes.
 */
export function getOptionsFromAttributes(
  attributesNode: ReadonlyArray<JSXAttribute | JSXSpreadAttribute>,
  validOptions: any,
  ignoredAttrs: Record<string, unknown>
): ObjectExpression {
  const options: Array<ObjectMethod | ObjectProperty | SpreadElement> = [];

  for (const node of attributesNode) {
    if (isJSXSpreadAttribute(node)) {
      continue;
    }

    const name = node.name.type === 'JSXIdentifier' ? node.name.name : null;
    if (!name) {
      continue;
    }
    // Required attributes are passed as a separate argument in the fbt(...)
    // call, because they're required. They're not passed as options.
    // Ignored attributes are simply stripped from the function call entirely
    // and ignored.  By default, we ignore all "private" attributes with a
    // leading '__' like '__source' and '__self' as added by certain
    // babel/react plugins
    if (ignoredAttrs[name] || name.startsWith('__')) {
      continue;
    }

    let value: Expression | JSXExpressionContainer | null | undefined =
      node.value;
    if (value === null && canBeShortBoolAttr(String(name))) {
      value = booleanLiteral(true);
    } else if (
      isJSXExpressionContainer(value) &&
      !isJSXEmptyExpression(value.expression)
    ) {
      value = value.expression;
    } else if (
      isStringLiteral(value) &&
      (value.value === 'true' || value.value === 'false')
    ) {
      value = booleanLiteral(value.value === 'true');
    }

    if (value) {
      options.push(
        objectProperty(
          stringLiteral(checkOption(name, validOptions, value)),
          value as Expression
        )
      );
    }
  }

  return objectExpression(options);
}

type ErrorWithBabelNodeLocation = Error & {
  _hasBabelNodeLocation?: boolean;
};

const isErrorWithNodeLocation = (
  error: unknown
): error is ErrorWithBabelNodeLocation =>
  error instanceof Error && '_hasBabelNodeLocation' in error;
/**
 * Prepend Babel node debug info (location, source code) to an Error message.
 *
 * @param msgOrError If we're given an Error object, we'll prepend the babel node info
 * to its message (only once).
 * If it's a string, we'll create a new Error object ourselves.
 */
export function errorAt(
  astNode?: Node | null,
  msgOrError: string | ErrorWithBabelNodeLocation | unknown = '',
  options: {
    suggestOSSWebsite?: boolean;
  } = {}
): ErrorWithBabelNodeLocation {
  let error;

  if (typeof msgOrError === 'string') {
    const newError = new Error(
      createErrorMessageAtNode(astNode, msgOrError, options)
    );
    error = newError as ErrorWithBabelNodeLocation;
    error._hasBabelNodeLocation = astNode?.loc != null;
  } else {
    error = msgOrError;
    if (
      isErrorWithNodeLocation(error) &&
      error._hasBabelNodeLocation !== true
    ) {
      error.message = createErrorMessageAtNode(astNode, error.message, options);
      error._hasBabelNodeLocation = astNode?.loc != null;
    }
  }
  return error as ErrorWithBabelNodeLocation;
}

function createErrorMessageAtNode(
  astNode?: Node | null,
  msg: string = '',
  options: {
    suggestOSSWebsite?: boolean;
  } = {}
): string {
  const location = astNode && astNode.loc;
  const optionalMessage = options.suggestOSSWebsite
    ? 'See the docs at https://facebook.github.io/fbt/ for more info.'
    : null;

  return (
    (location != null
      ? `Line ${location.start.line} Column ${location.start.column + 1}: `
      : '') +
    msg +
    (optionalMessage ? `\n${optionalMessage}` : '') +
    (astNode != null
      ? `\n---\n${generateFormattedCodeFromAST(astNode)}\n---`
      : '')
  );
}

// Collects options from an fbt construct in functional form
export function collectOptions(
  moduleName: JSModuleNameType,
  options: ObjectExpression | null | undefined,
  validOptions: FbtOptionConfig
): FbtOptionValues {
  const key2value: FbtOptionValues = {};
  if (options == null) {
    return key2value;
  }

  options.properties.forEach((option) => {
    if (!isObjectProperty(option)) {
      throw errorAt(
        option,
        `options object must contain plain object properties. ` +
          `No method definitions or spread operators.`
      );
    }

    const key = option.key;
    let optionName;
    if (isIdentifier(key) && typeof key.name === 'string') {
      optionName = key.name;
    } else if (isStringLiteral(key)) {
      optionName = key.value;
    } else {
      throw errorAt(
        option,
        `Expected property name to be an identifier or a string literal.`
      );
    }
    optionName = checkOption(optionName, validOptions, option.value);

    if (isArrowFunctionExpression(option.value)) {
      throw errorAt(
        option,
        `${moduleName}(...) does not allow an arrow function as an option value`
      );
    }

    const value =
      ('expression' in option.value && option.value.expression) || option.value;

    // Append only default valid options excluding "extraOptions",
    // which are used only by specific runtimes.
    if (hasOwnProperty.call(validOptions, optionName)) {
      key2value[optionName] = isTextualNode(value)
        ? normalizeSpaces(expandStringConcat(moduleName, value).value)
        : value;
    }
  });
  return key2value;
}

export function collectOptionsFromFbtConstruct(
  moduleName: JSModuleNameType,
  callsiteNode: CallExpression | null | undefined | JSXElement,
  validOptions: FbtOptionConfig,
  booleanOptions: Partial<Record<string, unknown>> | null = null
): FbtOptionValues {
  let optionsNode: ObjectExpression | null | undefined = null;
  let options = {} as FbtOptionValues;
  if (isCallExpression(callsiteNode)) {
    optionsNode = getOptionsNodeFromCallExpression(moduleName, callsiteNode);
    options = collectOptions(moduleName, optionsNode, validOptions);
  } else if (isJSXElement(callsiteNode)) {
    throw errorAt(
      callsiteNode,
      'Collecting options from JSX element is not supported yet'
    );
  }

  Object.keys(options).forEach((key) => {
    if (booleanOptions && hasOwnProperty.call(booleanOptions, key)) {
      options[key] = getOptionBooleanValue(
        options,
        key,
        optionsNode || callsiteNode
      );
    } else if (
      options[key] &&
      options[key] !== true &&
      typeof options[key] !== 'string' &&
      isBooleanLiteral(options[key])
    ) {
      options[key] = options[key].value;
    }
  });
  return options;
}

export function getOptionsNodeFromCallExpression(
  moduleName: JSModuleNameType,
  node: CallExpression
): ObjectExpression | null | undefined {
  const optionsNode = node.arguments[2];
  if (optionsNode == null) {
    return null;
  }
  if (!isObjectExpression(optionsNode)) {
    throw errorAt(
      optionsNode,
      `${moduleName}(...) expects options as an ObjectExpression as its 3rd argument`
    );
  }
  return optionsNode;
}

/**
 * Given a node that could be a recursive binary operation over string literals
 * (i.e. string concatenation), expand it into a string literal.
 */
export function expandStringConcat(
  moduleName: string,
  node: Node
): StringLiteral | JSXText {
  if (isBinaryExpression(node)) {
    if (node.operator !== '+') {
      throw errorAt(
        node,
        `Expected concatenation operator (+) but got ${node.operator}`
      );
    }
    return stringLiteral(
      expandStringConcat(moduleName, node.left).value +
        expandStringConcat(moduleName, node.right).value
    );
  } else if (isStringLiteral(node)) {
    return node;
  } else if (isJSXText(node)) {
    return node;
  } else if (isTemplateLiteral(node)) {
    let string = '';
    const expressions = node.expressions;

    let index = 0;
    for (const elem of node.quasis) {
      if (elem.value.cooked) {
        string += elem.value.cooked;
      }

      if (index < expressions.length) {
        const expr = expressions[index++];
        // fbt.param expressions are already transformed to StringLiteral
        if (!isStringLiteral(expr)) {
          throw errorAt(
            node,
            `${moduleName} template placeholders only accept params wrapped in ` +
              `${moduleName}.param. Expected StringLiteral got ${expr.type}`
          );
        }
        string += expr.value;
      }
    }

    return stringLiteral(string);
  }

  throw errorAt(
    node,
    `${moduleName} only accepts plain strings with params wrapped in ${moduleName}.param(...). ` +
      `See the docs at https://facebook.github.io/fbt/ for more info. ` +
      `Expected StringLiteral, TemplateLiteral, or concatenation; ` +
      `got "${node.type}"`
  );
}

export function expandStringArray(
  moduleName: string,
  node: ArrayExpression
): StringLiteral {
  return stringLiteral(
    nullthrows(node.elements)
      .map(
        (element) => expandStringConcat(moduleName, nullthrows(element)).value
      )
      .join('')
  );
}

// Check that the value of the given option name is a BabeNodeBooleanLiteral
// and return its value
export function getOptionBooleanValue<K extends string>(
  options: FbtOptionValues,
  name: K,
  node?: Node | null
): boolean {
  if (!hasOwnProperty.call(options, name)) {
    return false;
  }
  const value = options[name];
  if (
    value &&
    typeof value !== 'string' &&
    typeof value !== 'boolean' &&
    isBooleanLiteral(value)
  ) {
    return value.value;
  }

  throw errorAt(
    node,
    `Value for option "${name}" must be Boolean literal 'true' or 'false'.`
  );
}

/**
 * Utility for getting the first attribute by name from a list of attributes.
 */
export function getAttributeByNameOrThrow(
  attributes: BabelNodeJSXAttributes,
  name: string,
  node: Node | null = null
): JSXAttribute {
  const attr = getAttributeByName(attributes, name);
  if (attr == undefined) {
    throw errorAt(node, `Unable to find attribute "${name}".`);
  }
  return attr;
}

export function getAttributeByName(
  attributes: BabelNodeJSXAttributes,
  name: string
): JSXAttribute | null | undefined {
  for (let i = 0; i < attributes.length; i++) {
    const attr = attributes[i];
    if (isJSXAttribute(attr) && attr.name.name === name) {
      return attr;
    }
  }
  return undefined;
}

export function getOpeningElementAttributes(
  node: JSXElement
): ReadonlyArray<JSXAttribute> {
  return node.openingElement.attributes.map((attribute) => {
    if (isJSXSpreadAttribute(attribute)) {
      throw errorAt(attribute, `Do no use the JSX spread attribute`);
    }
    return attribute;
  });
}

export function objMap<
  Object extends Partial<Record<Key, Value>>,
  Key extends string | number,
  Value,
  ResultValue
>(
  object: Object,
  fn: (value: Value, arg2: Key) => ResultValue
): Record<Key, ResultValue> {
  const newObject: Partial<Record<Key, ResultValue>> = {};
  for (const k of Object.keys(object)) {
    newObject[k as Key] = fn(object[k as Key] as Value, k as Key);
  }
  return newObject as Record<Key, ResultValue>;
}

/**
 * Does this object have keys?
 *
 * Note: this breaks on any actual "class" object with prototype
 * members
 *
 * The micro-optimized equivalent of `Object.keys(o).length > 0` but
 * without the throw-away array
 */
export function hasKeys(o: Record<string, unknown>): boolean {
  for (const k in o) {
    return k ? true : true;
  }
  return false;
}

export function getRawSource(src: string, node: Node): string {
  return node.start != null && node.end != null
    ? src.slice(node.start, node.end)
    : '';
}

/**
 * Filter whitespace-only nodes from a list of nodes.
 */
export function filterEmptyNodes<B extends Node>(
  nodes: ReadonlyArray<B>
): ReadonlyArray<B> {
  return nodes.filter((node) => {
    // Filter whitespace and comment block
    return !(
      (isJSXText(node) && node.value.match(/^\s+$/)) ||
      (isJSXExpressionContainer(node) && isJSXEmptyExpression(node.expression))
    );
  });
}

export function assertModuleName(moduleName: string): JSModuleNameType {
  if (moduleName === FBT || moduleName === FBS) {
    return moduleName;
  }
  throw new Error(`Unsupported module name: "${moduleName}"`);
}

export function textContainsFbtLikeModule(text: string): boolean {
  return ModuleNameRegExp.test(text);
}

export function convertTemplateLiteralToArrayElements(
  moduleName: JSModuleNameType,
  node: TemplateLiteral
): Array<StringLiteral | CallExpression | JSXElement> {
  const { expressions, quasis } = node;
  const nodes: Array<StringLiteral | CallExpression | JSXElement> = [];

  let index = 0;
  // quasis items are the text literal portion of the template literal
  for (const item of quasis) {
    const text = item.value.cooked || '';
    if (text != '') {
      nodes.push(stringLiteral(text));
    }
    if (index < expressions.length) {
      const expression = expressions[index++];
      if (
        expression.type === 'StringLiteral' ||
        expression.type === 'CallExpression' ||
        expression.type === 'JSXElement'
      ) {
        nodes.push(expression);
      } else {
        throw errorAt(
          expression,
          `Unexpected node type: ${expression.type}. ${moduleName}() only supports ` +
            `the following syntax within template literals:` +
            `string literal, a construct like ${moduleName}.param() or a JSX element.`
        );
      }
    }
  }
  return nodes;
}

export function getBinaryExpressionOperands(
  moduleName: JSModuleNameType,
  node: Expression | PrivateName
): Array<CallExpression | StringLiteral | TemplateLiteral> {
  switch (node.type) {
    case 'BinaryExpression':
      if (node.operator !== '+') {
        throw errorAt(node, 'Expected to see a string concatenation');
      }
      return [
        ...getBinaryExpressionOperands(moduleName, node.left),
        ...getBinaryExpressionOperands(moduleName, node.right),
      ];
    case 'CallExpression':
    case 'StringLiteral':
    case 'TemplateLiteral':
      return [node];
    default:
      throw errorAt(
        node,
        `Unexpected node type: ${node.type}. ` +
          `The ${moduleName}() string concatenation pattern only supports ` +
          ` string literals or constructs like ${moduleName}.param().`
      );
  }
}

export function convertToStringArrayNodeIfNeeded(
  moduleName: JSModuleNameType,
  node: CallExpression['arguments'][number]
): ArrayExpression {
  let initialElements;
  let didStartWithArray = false;
  switch (node.type) {
    case 'ArrayExpression':
      initialElements = nullthrows(node.elements);
      didStartWithArray = true;
      break;
    case 'CallExpression':
    case 'StringLiteral':
      initialElements = [node];
      break;

    case 'BinaryExpression': {
      initialElements = getBinaryExpressionOperands(moduleName, node);
      break;
    }
    case 'TemplateLiteral': {
      initialElements = convertTemplateLiteralToArrayElements(moduleName, node);
      break;
    }

    default:
      throw errorAt(
        node,
        `Unexpected node type: ${node.type}. ` +
          `${moduleName}()'s first argument should be a string literal, ` +
          `a construct like ${moduleName}.param() or an array of those.`
      );
  }

  // Let's also convert the 1st level of elements of the array
  // to process nested string concatenations and template literals one last time.
  // We're not making this fully recursive since, from a syntax POV,
  // it wouldn't be elegant to allow developers to nest lots of template literals.
  return arrayExpression(
    initialElements.reduce((elements, element) => {
      if (element == null) {
        return elements;
      }
      if (
        didStartWithArray &&
        (element.type === 'BinaryExpression' ||
          (element.type === 'TemplateLiteral' && element.expressions.length))
      ) {
        throw errorAt(
          element,
          `${moduleName}(array) only supports items that are string literals, ` +
            `template literals without any expressions, or fbt constructs`
        );
      }
      switch (element.type) {
        case 'BinaryExpression': {
          elements.push(...getBinaryExpressionOperands(moduleName, element));
          break;
        }
        case 'TemplateLiteral': {
          elements.push(
            ...convertTemplateLiteralToArrayElements(moduleName, element)
          );
          break;
        }
        default:
          elements.push(element);
      }
      return elements;
    }, [] as Array<null | Expression | SpreadElement>)
  );
}

/**
 * For a given object, replace any property that refers to a BabelNode with a string like
 * `'BabelNode[type=SomeBabelType]'`.
 * We'll also create a new property that'll contain the serialized JS code from the BabelNode.
 *
 * @example
 *   compactBabelNodeProps({
 *     node: t.stringLiteral('hello')
 *   })
 *
 *   // Output:
 *   {
 *     node: 'BabelNode[type=StringLiteral]'
 *     __nodeCode: "'hello'"
 *   }
 */
export function compactBabelNodeProps(
  object: Record<string, unknown>,
  serializeSourceCode: boolean = true
): Record<string, unknown> {
  const ret = { ...object };
  for (const propName of Object.keys(ret)) {
    const propValue = ret[propName];
    if (!isNode(propValue)) {
      continue;
    }
    if (serializeSourceCode) {
      ret[`__${propName}Code`] = generateFormattedCodeFromAST(propValue);
    }
    ret[propName] = `BabelNode[type=${propValue.type || ''}]`;
  }
  return ret;
}

export function varDump(value: unknown, depth: number = 1): string {
  return (
    util.inspect(value, {
      depth,
    }) || 'undefined'
  );
}

export function enforceString(
  value: unknown,
  valueDesc?: string | null
): string {
  invariant(
    typeof value === 'string',
    '%sExpected string value instead of %s (%s)',
    valueDesc ? valueDesc + ' - ' : '',
    varDump(value),
    typeof value
  );
  return value;
}

export function enforceBoolean(
  value: unknown,
  valueDesc?: string | null
): boolean {
  invariant(
    typeof value === 'boolean',
    '%sExpected boolean value instead of %s (%s)',
    valueDesc ? valueDesc + ' - ' : '',
    varDump(value),
    typeof value
  );
  return value;
}

export function enforceBabelNode(
  value: unknown,
  valueDesc?: string | null
): Node {
  invariant(
    isNode(value),
    '%sExpected BabelNode value instead of %s (%s)',
    valueDesc ? valueDesc + ' - ' : '',
    varDump(value),
    typeof value
  );
  return value;
}

export function enforceBabelNodeCallExpressionArg(
  value: Node | undefined | null,
  valueDesc?: string | null
): CallExpressionArg {
  invariant(
    value && isBabelNodeCallExpressionArg(value),
    '%sExpected BabelNodeCallExpressionArg value instead of %s (%s)',
    valueDesc ? valueDesc + ' - ' : '',
    varDump(value),
    typeof value
  );
  return value;
}

export function enforceStringEnum<K extends string>(
  value: string,
  keys: Partial<Record<K, unknown>>,
  valueDesc?: string | null
): K {
  invariant(
    typeof value === 'string' && hasOwnProperty.call(keys, value),
    '%sExpected value to be one of [%s] but we got %s (%s) instead',
    valueDesc ? valueDesc + ' - ' : '',
    Object.keys(keys).join(', '),
    varDump(value),
    typeof value
  );
  return value as K;
}

// Given a type enforcer function, make it also accept a nullable value
function nullableTypeCheckerFactory<
  ArgVal,
  Args extends ReadonlyArray<ArgVal>,
  Ret,
  Val
>(
  checker: (arg1: Val, ...args: Args) => Ret
): (arg1: Val, ...args: Args) => Ret | null | undefined {
  return (value, ...args) => {
    return value == null ? null : checker(value, ...args);
  };
}

const enforceBabelNodeOrNull: (
  value: unknown,
  valueDesc?: string | null | undefined
) => Node | null | undefined = nullableTypeCheckerFactory(enforceBabelNode);
enforceBabelNode.orNull = enforceBabelNodeOrNull;

enforceBabelNodeCallExpressionArg.orNull = nullableTypeCheckerFactory(
  enforceBabelNodeCallExpressionArg
);

const enforceBooleanOrNull: (
  value: unknown,
  valueDesc?: string | null | undefined
) => boolean | null | undefined = nullableTypeCheckerFactory(enforceBoolean);
enforceBoolean.orNull = enforceBooleanOrNull;

const enforceStringOrNull: (
  value: unknown,
  valueDesc?: string | null | undefined
) => string | null | undefined = nullableTypeCheckerFactory(enforceString);
enforceString.orNull = enforceStringOrNull;

enforceStringEnum.orNull = nullableTypeCheckerFactory(enforceStringEnum);

/**
 * Creates an `fbt._<<methodName>>(args)` runtime function call.
 * <<methodName>> is inferred from the given fbtNode
 * @param fbtNode This fbt FbtNode that created this function call
 * @param args Arguments of the function call
 * @param overrideMethodName Use this method name instead of the one from the fbtNode
 */
export function createFbtRuntimeArgCallExpression(
  fbtNode: AnyFbtNode,
  args: Array<CallExpressionArg>,
  overrideMethodName?: string
): CallExpression {
  return callExpression(
    memberExpression(
      identifier(fbtNode.moduleName),
      identifier(
        '_' +
          (overrideMethodName ||
            nullthrows(
              (fbtNode.constructor as unknown as { type: string }).type
            ))
      )
    ),
    args
  );
}

/**
 * Clear token names in translations and runtime call texts need to be replaced
 * by their aliases in order for the runtime logic to work.
 */
export function replaceClearTokensWithTokenAliases(
  textOrTranslation: PatternString,
  tokenAliases?: TokenAliases | null
): string {
  if (tokenAliases == null) {
    return textOrTranslation;
  }

  // avoid cyclic dependency
  const { tokenNameToTextPattern } = require('./fbt-nodes/FbtNodeUtil');
  return Object.keys(tokenAliases).reduce(
    (mangledText: string, clearToken: string) => {
      const clearTokenName = tokenNameToTextPattern(clearToken);
      const mangledTokenName = tokenNameToTextPattern(tokenAliases[clearToken]);
      // Since a string is not allowed to have implicit params with duplicated
      // token names, replacing the first and therefore the only occurence of
      // `clearTokenName` is sufficient.
      return mangledText.replace(clearTokenName, mangledTokenName);
    },
    textOrTranslation
  );
}

const generateFormattedCodeFromAST = (node: Node) =>
  generate(node, { comments: true }, '').code.trim();
