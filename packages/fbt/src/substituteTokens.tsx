import {
  applyPhonologicalRules,
  dedupeStops,
  PUNCT_CHAR_CLASS,
} from './IntlPunctuation.tsx';
import { FbtContentItem, NestedFbtContentItems } from './Types.tsx';

// This pattern finds tokens inside a string: 'string with {token} inside'.
// It also grabs any punctuation that may be present after the token, such as
// brackets, fullstops and elipsis (for various locales too!)
const parameterRegexp = new RegExp(
  String.raw`\{([^}]+)\}(` + PUNCT_CHAR_CLASS + '*)',
  'g'
);

export type Substitutions = {
  [paramName: string]: FbtContentItem;
};

/**
 * Does the token substitution fbt() but without the string lookup.
 * Used for in-place substitutions in translation mode.
 */
export default function substituteTokens(
  template: string,
  args: Substitutions | null
): FbtContentItem | NestedFbtContentItems {
  if (args == null) {
    return template;
  }

  // Splice in the arguments while keeping rich object ones separate.
  const objectPieces: Array<FbtContentItem> = [];
  const argNames = [];
  let index = 0;
  const stringPieces = template
    .replace(
      parameterRegexp,
      (_match: string, parameter: string, punctuation: string): string => {
        let argument = args[parameter];
        if (argument != null && typeof argument === 'object') {
          if ('key' in argument && argument.key === null) {
            argument = { ...argument, key: `${index++}` };
          }
          objectPieces.push(argument);
          argNames.push(parameter);
          // End of Transmission Block sentinel marker
          return '\u0017' + punctuation;
        } else if (argument == null) {
          return '{' + parameter + '}' + punctuation;
        }
        return String(argument) + dedupeStops(String(argument), punctuation);
      }
    )
    .split('\u0017')
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
