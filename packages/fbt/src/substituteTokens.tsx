// flowlint ambiguous-object-type:error

import invariant from 'invariant';
import {
  applyPhonologicalRules,
  dedupeStops,
  PUNCT_CHAR_CLASS,
} from './IntlPunctuation';
import { IFbtErrorListener } from './Types';

const { hasOwnProperty } = Object.prototype;

// This pattern finds tokens inside a string: 'string with {token} inside'.
// It also grabs any punctuation that may be present after the token, such as
// brackets, fullstops and elipsis (for various locales too!)
const parameterRegexp = new RegExp(
  '\\{([^}]+)\\}(' + PUNCT_CHAR_CLASS + '*)',
  'g'
);

export type MaybeReactComponent = Partial<{
  type?: string;
  props?: Record<any, any>;
  _store?: {
    validated: boolean | number;
  };
}>;

export type Substitutions = {
  [paramName: string]: MaybeReactComponent;
};

// Hack into React internals to avoid key warnings
function markAsSafeForReact<T extends MaybeReactComponent>(object: T): T {
  if (process.env.NODE_ENV === 'development') {
    // If this looks like a ReactElement, mark it as safe to silence any
    // key warnings.

    // I use a string key to avoid any possible private variable transforms.
    const storeKey = '_store';

    const store = object[storeKey];
    if (
      object.type != null &&
      object.type != '' &&
      typeof object.props === 'object' &&
      store != null &&
      typeof store === 'object'
    ) {
      if (typeof store.validated === 'number') {
        store.validated = 1;
      } else if (typeof store.validated === 'boolean') {
        store.validated = true;
      }
    }
  }
  return object;
}

/**
 * Does the token substitution fbt() but without the string lookup.
 * Used for in-place substitutions in translation mode.
 */
export default function substituteTokens(
  template: string,
  args: Substitutions,
  errorListener?: IFbtErrorListener | null
): string | Array<string | MaybeReactComponent> {
  if (args == null) {
    return template;
  }

  invariant(
    typeof args === 'object',
    'The 2nd argument must be an object (not a string) for tx(%s, ...)',
    template
  );

  // Splice in the arguments while keeping rich object ones separate.
  const objectPieces: Array<MaybeReactComponent> = [];
  const argNames = [];
  const stringPieces = template
    .replace(
      parameterRegexp,
      (_match: string, parameter: string, punctuation: string): string => {
        if (!hasOwnProperty.call(args, parameter)) {
          errorListener?.onMissingParameterError?.(
            Object.keys(args),
            parameter
          );
        }

        const argument = args[parameter];
        if (argument != null && typeof argument === 'object') {
          objectPieces.push(argument);
          argNames.push(parameter);
          // End of Transmission Block sentinel marker
          return '\x17' + punctuation;
        } else if (argument == null) {
          return '';
        }
        return String(argument) + dedupeStops(String(argument), punctuation);
      }
    )
    .split('\x17')
    .map(applyPhonologicalRules);

  if (stringPieces.length === 1) {
    return stringPieces[0];
  }

  // Zip together the lists of pieces.
  // We skip adding empty strings from stringPieces since they were
  // injected from translation patterns that only contain tokens. See D20453562
  const pieces: Array<string | MaybeReactComponent> =
    stringPieces[0] !== '' ? [stringPieces[0]] : [];
  for (let i = 0; i < objectPieces.length; i++) {
    pieces.push(markAsSafeForReact(objectPieces[i]));
    if (stringPieces[i + 1] !== '') {
      pieces.push(stringPieces[i + 1]);
    }
  }
  return pieces;
}
