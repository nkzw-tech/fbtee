import {
  applyPhonologicalRules,
  dedupeStops,
  PUNCT_CHAR_CLASS,
} from './IntlPunctuation.tsx';
import type { FbtContentItem, NestedFbtContentItems } from './Types.ts';

// This pattern finds tokens inside a string: 'string with {token} inside'.
// It also grabs any punctuation that may be present after the token, such as
// brackets, fullstops and elipsis (for various locales too!)
const parameterRegexp = new RegExp(
  String.raw`\{([^}]+)\}(` + PUNCT_CHAR_CLASS + '*)',
  'g',
);

export type Substitutions = {
  [paramName: string]: FbtContentItem;
};

/**
 * Placeholder character for a token value within translation pattern strings
 * using the "End of Transmission Block" unicode character.
 */
const TOKEN_VALUE_PLACEHOLDER_CHAR = '\u0017';

/**
 * Does the token substitution fbt() but without the string lookup.
 * Used for in-place substitutions in translation mode.
 */
export default function substituteTokens(
  template: string,
  args: Substitutions | null,
): FbtContentItem | NestedFbtContentItems {
  if (args == null) {
    return template;
  }

  // Splice in the arguments while keeping rich object ones separate.
  const objectPieces: Array<FbtContentItem> = [];
  let index = 0;
  const stringPieces = template
    .replace(
      parameterRegexp,
      (_match: string, name: string, punctuation: string): string => {
        let argument = args[name];
        // If token value is a React component.
        if (argument != null && typeof argument === 'object') {
          // Add an implicit "key" property to help React keep track of each array item.
          if ('key' in argument && argument.key === null) {
            argument = { ...argument, key: `$fbtee-${name}-${index++}$` };
          }
          // Save the token value into objectPieces and replace its string with a placeholder.
          objectPieces.push(argument);
          return TOKEN_VALUE_PLACEHOLDER_CHAR + punctuation;
        } else if (argument == null) {
          return '{' + name + '}' + punctuation;
        }
        return String(argument) + dedupeStops(String(argument), punctuation);
      },
    )
    .split(TOKEN_VALUE_PLACEHOLDER_CHAR)
    .map(applyPhonologicalRules);

  if (stringPieces.length === 1) {
    return stringPieces[0];
  }

  // Zip together the lists of pieces.
  // We skip adding empty strings from stringPieces since they were
  // injected from translation patterns that only contain tokens.
  const pieces: Array<FbtContentItem> =
    stringPieces[0] !== '' ? [stringPieces[0]] : [];
  for (let i = 0; i < objectPieces.length; i++) {
    pieces.push(objectPieces[i]);
    if (stringPieces[i + 1] !== '') {
      pieces.push(stringPieces[i + 1]);
    }
  }
  return pieces;
}
