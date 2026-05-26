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
  JSXFragment,
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
import type { AnyFbtNode } from './fbt-nodes/FbtNode.tsx';
import type {
  BindingName,
  FbtOptionConfig,
  FbtOptionValue,
  FbtOptionValues,
} from './FbtConstants.tsx';
import { ModuleNameRegExp } from './FbtConstants.tsx';
import nullthrows from './nullthrows.tsx';

const { hasOwnProperty } = Object.prototype;

export type CallExpressionArg =
  | Expression
  | SpreadElement
  | ArgumentPlaceholder;
export type CallExpressionArgument = CallExpression['arguments'][number];
export type ParamSet = {
  [parameterName: string]: Node | null;
};

export function normalizeSpaces(
  value: string,
  options?: {
    preserveWhitespace?: FbtOptionValue | null;
  } | null,
): string {
  if (options && options.preserveWhitespace) {
    return value;
  }
  // We're  willingly preserving non-breaking space characters (\u00A0)
  // See D33402749 for more info.
  return value.replaceAll(/[^\S\u00A0]+/g, ' ');
}

export function cleanJSXText(value: string): string {
  const lines = value.split(/\r\n|\n|\r/);
  let lastNonEmptyLine = 0;
  for (let index = 0; index < lines.length; index++) {
    if (/[^\t ]/.test(lines[index])) {
      lastNonEmptyLine = index;
    }
  }

  let output = '';
  for (let index = 0; index < lines.length; index++) {
    const isFirstLine = index === 0;
    const isLastLine = index === lines.length - 1;
    const isLastNonEmptyLine = index === lastNonEmptyLine;
    let line = lines[index].replaceAll('\t', ' ');

    if (!isFirstLine) {
      line = line.replace(/^ +/, '');
    }
    if (!isLastLine) {
      line = line.replace(/ +$/, '');
    }
    if (line) {
      output += isLastNonEmptyLine ? line : `${line} `;
    }
  }
  return output;
}

function isNodeCallExpressionArg(value: Node): value is CallExpressionArg {
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
  paramSet: ParamSet,
) {
  const cachedNode = paramSet[name];
  if (cachedNode && cachedNode != node) {
    throw errorAt(
      node,
      `Token '${name}' is already used in this ${moduleName} call. ` +
        `Use ${moduleName}.sameParam('${name}') to reuse it, or choose a different name.`,
    );
  }
  paramSet[name] = node;
}

export function checkOption<K extends string>(
  option: string,
  validOptions: FbtOptionConfig,
  value?: Node | null | string | boolean,
): K {
  const optionName = option as K;

  if (optionName === 'key') {
    return optionName;
  }

  const validValues = validOptions[optionName];
  if (!hasOwnProperty.call(validOptions, optionName) || validValues == null) {
    throw errorAt(
      isNode(value) ? value : null,
      `Unknown option '${optionName}'. ` +
        `Use one of: ${Object.keys(validOptions).join(', ')}.`,
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
        `Option '${optionName}' must be a string literal. ` +
          `Received '${varDump(value)}' (${typeof value}).`,
      );
    }

    if (!validValues[valueStr]) {
      throw errorAt(
        isNode(value) ? value : null,
        `Invalid value '${valueStr}' for option '${optionName}'. ` +
          `Use one of: ${Object.keys(validValues).join(', ')}.`,
      );
    }
  }
  return optionName;
}

const boolCandidates = new Set<string>([
  'common',
  'doNotExtract',
  'number',
  'preserveWhitespace',
]);

/**
 * Build options list form corresponding attributes.
 */
export function getOptionsFromAttributes(
  attributesNode: ReadonlyArray<JSXAttribute | JSXSpreadAttribute>,
  validOptions: FbtOptionConfig,
  ignoredAttrs: Record<string, unknown>,
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
    if (value === null && boolCandidates.has(name)) {
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
          value as Expression,
        ),
      );
    }
  }

  return objectExpression(options);
}

type ErrorWithNodeLocation = Error & {
  _hasNodeLocation?: boolean;
};

const isErrorWithNodeLocation = (
  error: unknown,
): error is ErrorWithNodeLocation =>
  error instanceof Error && '_hasNodeLocation' in error;
/**
 * Prepend node debug info (location, source code) to an Error message.
 *
 * @param msgOrError If we're given an Error object, we'll prepend the node info
 * to its message (only once).
 * If it's a string, we'll create a new Error object ourselves.
 */
export function errorAt(
  astNode?: Node | null,
  msgOrError: unknown = '',
): ErrorWithNodeLocation {
  let error;

  if (typeof msgOrError === 'string') {
    const newError = new Error(createErrorMessageAtNode(astNode, msgOrError));
    error = newError as ErrorWithNodeLocation;
    error._hasNodeLocation = astNode?.loc != null;
  } else {
    error = msgOrError;
    if (isErrorWithNodeLocation(error) && error._hasNodeLocation !== true) {
      error.message = createErrorMessageAtNode(astNode, error.message);
      error._hasNodeLocation = astNode?.loc != null;
    }
  }
  return error as ErrorWithNodeLocation;
}

const generateFormattedCodeFromAST = (node: Node) =>
  generate.default(node, { comments: true }, '').code.trim();

function createErrorMessageAtNode(
  astNode?: Node | null,
  msg: string = '',
): string {
  const location = astNode && astNode.loc;
  return (
    (location != null
      ? `Line ${location.start.line} Column ${location.start.column + 1}: `
      : '') +
    msg +
    (astNode != null
      ? `\n---\n${generateFormattedCodeFromAST(astNode)}\n---`
      : '')
  );
}

// Collects options from an fbt construct in functional form
export function collectOptions(
  moduleName: BindingName,
  options: ObjectExpression | null,
  validOptions: FbtOptionConfig,
): FbtOptionValues {
  const key2value: FbtOptionValues = {};
  if (options == null) {
    return key2value;
  }

  options.properties.forEach((option) => {
    if (!isObjectProperty(option)) {
      throw errorAt(
        option,
        `Options must be plain object properties. Remove methods and spread properties.`,
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
        `Option names must be identifiers or string literals.`,
      );
    }
    optionName = checkOption(optionName, validOptions, option.value);

    if (isArrowFunctionExpression(option.value)) {
      throw errorAt(
        option,
        `${moduleName}(...) options cannot be arrow functions. Pass a value instead.`,
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
  moduleName: BindingName,
  callsiteNode: CallExpression | null | JSXElement,
  validOptions: FbtOptionConfig,
  booleanOptions: Partial<Record<string, unknown>> | null = null,
): FbtOptionValues {
  let optionsNode: ObjectExpression | null = null;
  let options = {} as FbtOptionValues;
  if (isCallExpression(callsiteNode)) {
    optionsNode = getOptionsNodeFromCallExpression(moduleName, callsiteNode);
    options = collectOptions(moduleName, optionsNode, validOptions);
  } else if (isJSXElement(callsiteNode)) {
    throw errorAt(
      callsiteNode,
      `Cannot collect options from a JSX element here. Use ${moduleName}(...) syntax.`,
    );
  }

  Object.keys(options).forEach((key) => {
    if (booleanOptions && hasOwnProperty.call(booleanOptions, key)) {
      options[key] = getOptionBooleanValue(
        options,
        key,
        optionsNode || callsiteNode,
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
  moduleName: BindingName,
  node: CallExpression,
): ObjectExpression | null {
  const optionsNode = node.arguments[2];
  if (optionsNode == null) {
    return null;
  }
  if (!isObjectExpression(optionsNode)) {
    throw errorAt(
      optionsNode,
      `${moduleName}(...) options must be an object literal in the third argument.`,
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
  node: Node,
): StringLiteral | JSXText {
  if (isBinaryExpression(node)) {
    if (node.operator !== '+') {
      throw errorAt(
        node,
        `Only string concatenation with '+' is supported here. Received '${node.operator}'.`,
      );
    }
    return stringLiteral(
      expandStringConcat(moduleName, node.left).value +
        expandStringConcat(moduleName, node.right).value,
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
            `${moduleName} template placeholders must be ${moduleName}.param(...). ` +
              `Received '${expr.type}'.`,
          );
        }
        string += expr.value;
      }
    }

    return stringLiteral(string);
  }

  throw errorAt(
    node,
    `${moduleName} text must be a string, template literal, or string concatenation. ` +
      `Wrap values in ${moduleName}.param(...). Received '${node.type}'.`,
  );
}

export function expandStringArray(
  moduleName: string,
  node: ArrayExpression,
): StringLiteral {
  return stringLiteral(
    nullthrows(node.elements)
      .map(
        (element) => expandStringConcat(moduleName, nullthrows(element)).value,
      )
      .join(''),
  );
}

// Check that the value of the given option name is a BabeNodeBooleanLiteral
// and return its value
export function getOptionBooleanValue<K extends string>(
  options: FbtOptionValues,
  name: K,
  node?: Node | null,
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
    `Option '${name}' must be the boolean literal 'true' or 'false'.`,
  );
}

/**
 * Utility for getting the first attribute by name from a list of attributes.
 */
type JSXAttributeWithValue = Omit<JSXAttribute, 'value'> &
  Readonly<{
    value: JSXElement | JSXFragment | StringLiteral | JSXExpressionContainer;
  }>;

const isJSXAttributeWithValue = (
  node: JSXAttribute,
): node is JSXAttributeWithValue => node.value != null;

export function getAttributeByNameOrThrow(
  node: JSXElement,
  name: string,
): JSXAttributeWithValue {
  const attribute = getAttributeByName(node, name);
  if (attribute == null) {
    throw errorAt(node, `Missing required attribute '${name}'.`);
  }

  if (!isJSXAttributeWithValue(attribute)) {
    throw errorAt(node, `Attribute '${name}' needs a value.`);
  }

  return attribute;
}

export function getAttributeByName(
  node: JSXElement,
  name: string,
): JSXAttribute | null {
  for (const attribute of node.openingElement.attributes) {
    if (isJSXAttribute(attribute) && attribute.name.name === name) {
      return attribute;
    }
  }
  return null;
}

export function getOpeningElementAttributes(
  node: JSXElement,
): ReadonlyArray<JSXAttribute> {
  return node.openingElement.attributes.map((attribute) => {
    if (isJSXSpreadAttribute(attribute)) {
      throw errorAt(attribute, `JSX spread attributes are not supported here.`);
    }
    return attribute;
  });
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
  nodes: ReadonlyArray<B>,
): ReadonlyArray<B> {
  return nodes.filter((node) => {
    // Filter whitespace and comment block
    return !(
      (isJSXText(node) && node.value.match(/^\s+$/)) ||
      (isJSXExpressionContainer(node) && isJSXEmptyExpression(node.expression))
    );
  });
}

export function textContainsFbtLikeModule(text: string): boolean {
  return ModuleNameRegExp.test(text);
}

export function convertTemplateLiteralToArrayElements(
  moduleName: BindingName,
  node: TemplateLiteral,
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
          `${moduleName} template placeholders must be string literals, ` +
            `${moduleName}.param(...), or JSX elements. Received '${expression.type}'.`,
        );
      }
    }
  }
  return nodes;
}

export function getBinaryExpressionOperands(
  moduleName: BindingName,
  node: Expression | PrivateName,
): Array<CallExpression | StringLiteral | TemplateLiteral> {
  switch (node.type) {
    case 'BinaryExpression':
      if (node.operator !== '+') {
        throw errorAt(
          node,
          `Only string concatenation with '+' is supported here.`,
        );
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
        `${moduleName}() string concatenation only supports string literals ` +
          `and constructs like ${moduleName}.param(...). Received '${node.type}'.`,
      );
  }
}

export function convertToStringArrayNodeIfNeeded(
  moduleName: BindingName,
  node: CallExpression['arguments'][number],
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
        `${moduleName}() text must be a string literal, ` +
          `a construct like ${moduleName}.param(...), or an array of those. ` +
          `Received '${node.type}'.`,
      );
  }

  // Let's also convert the 1st level of elements of the array
  // to process nested string concatenations and template literals one last time.
  // We're not making this fully recursive since, from a syntax POV,
  // it wouldn't be elegant to allow developers to nest lots of template literals.
  return arrayExpression(
    initialElements.reduce(
      (elements, element) => {
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
            `${moduleName}(array) items must be string literals, template literals without placeholders, ` +
              `or ${moduleName} constructs.`,
          );
        }
        switch (element.type) {
          case 'BinaryExpression': {
            elements.push(...getBinaryExpressionOperands(moduleName, element));
            break;
          }
          case 'TemplateLiteral': {
            elements.push(
              ...convertTemplateLiteralToArrayElements(moduleName, element),
            );
            break;
          }
          default:
            elements.push(element);
        }
        return elements;
      },
      [] as Array<null | Expression | SpreadElement>,
    ),
  );
}

/**
 * For a given object, replace any property that refers to a node with a string like
 * `'Node[type=SomeBabelType]'`.
 * We'll also create a new property that'll contain the serialized JS code from the node.
 *
 * @example
 *   compactNodeProps({
 *     node: t.stringLiteral('hello')
 *   })
 *
 *   // Output:
 *   {
 *     node: 'Node[type=StringLiteral]'
 *     __nodeCode: "'hello'"
 *   }
 */
export function compactNodeProps(
  object: AnyFbtNode | Record<string, unknown>,
  serializeSourceCode: boolean = true,
): Record<string, unknown> {
  const ret: Record<string, unknown> = { ...object };
  for (const key of Object.keys(ret)) {
    const propValue = ret[key];
    if (!isNode(propValue)) {
      continue;
    }
    if (serializeSourceCode) {
      ret[`__${key}Code`] = generateFormattedCodeFromAST(propValue);
    }
    ret[key] = `Node[type=${propValue.type || ''}]`;
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
  valueDesc?: string | null,
): string {
  invariant(
    typeof value === 'string',
    '%s must be a string. Received %s (%s).',
    valueDesc || 'Value',
    varDump(value),
    typeof value,
  );
  return value;
}

export function enforceBoolean(
  value: unknown,
  valueDesc?: string | null,
): boolean {
  invariant(
    typeof value === 'boolean',
    '%s must be a boolean. Received %s (%s).',
    valueDesc || 'Value',
    varDump(value),
    typeof value,
  );
  return value;
}

export function enforceNode(value: unknown, valueDesc?: string | null): Node {
  invariant(
    isNode(value),
    '%s must be a Babel node. Received %s (%s).',
    valueDesc || 'Value',
    varDump(value),
    typeof value,
  );
  return value;
}

export function enforceNodeCallExpressionArg(
  value: Node | null,
  valueDesc?: string | null,
): CallExpressionArg {
  invariant(
    value && isNodeCallExpressionArg(value),
    '%s must be a valid expression argument. Received %s (%s).',
    valueDesc || 'Value',
    varDump(value),
    typeof value,
  );
  return value;
}

export function enforceStringEnum<K extends string>(
  value: string,
  keys: Partial<Record<K, unknown>>,
  valueDesc?: string | null,
): K {
  invariant(
    typeof value === 'string' && hasOwnProperty.call(keys, value),
    '%s must be one of: %s. Received %s (%s).',
    valueDesc || 'Value',
    Object.keys(keys).join(', '),
    varDump(value),
    typeof value,
  );
  return value as K;
}

// Given a type enforcer function, make it also accept a nullable value
function nullableTypeCheckerFactory<
  ArgVal,
  Args extends ReadonlyArray<ArgVal>,
  Ret,
  Val,
>(
  checker: (arg1: Val, ...args: Args) => Ret,
): (arg1: Val, ...args: Args) => Ret | null {
  return (value, ...args) => {
    return value == null ? null : checker(value, ...args);
  };
}

const enforceNodeOrNull: (
  value: unknown,
  valueDesc?: string | null,
) => Node | null = nullableTypeCheckerFactory(enforceNode);
enforceNode.orNull = enforceNodeOrNull;

enforceNodeCallExpressionArg.orNull = nullableTypeCheckerFactory(
  enforceNodeCallExpressionArg,
);

const enforceBooleanOrNull: (
  value: unknown,
  valueDesc?: string | null,
) => boolean | null = nullableTypeCheckerFactory(enforceBoolean);
enforceBoolean.orNull = enforceBooleanOrNull;

const enforceStringOrNull: (
  value: unknown,
  valueDesc?: string | null,
) => string | null = nullableTypeCheckerFactory(enforceString);
enforceString.orNull = enforceStringOrNull;

enforceStringEnum.orNull = nullableTypeCheckerFactory(enforceStringEnum);

/**
 * Creates an `fbt._<<methodName>>(args)` runtime function call.
 * <<methodName>> is inferred from the given fbtNode
 * @param fbtNode This fbt FbtNode that created this function call
 * @param args Arguments of the function call
 * @param overrideMethodName Use this method name instead of the one from the fbtNode
 */
export function createRuntimeCallExpression(
  fbtNode: AnyFbtNode,
  args: Array<CallExpressionArg>,
  overrideMethodName?: string,
): CallExpression {
  return callExpression(
    memberExpression(
      identifier(fbtNode.moduleName),
      identifier('_' + (overrideMethodName || nullthrows(fbtNode.type))),
    ),
    args,
  );
}
