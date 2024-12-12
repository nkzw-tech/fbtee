import type { TokenConstraintPairs } from './TranslationBuilder.tsx';

/**
 * Concatenation of `TokenConstraintPairs` through `buildConstraintKey` method
 * e.g. 'user%2:count%24' is the `ConstraintKey` for [['user', 2], ['count', 24]]
 */
export type ConstraintKey = string;

/**
 * Build the aggregate key with which we access the constraint map.  The
 * constraint map maps the given constraints to the appropriate translation
 */
export function buildConstraintKey(
  constraintKeys: TokenConstraintPairs,
): ConstraintKey {
  return constraintKeys.map((kv) => kv[0] + '%' + kv[1]).join(':');
}
