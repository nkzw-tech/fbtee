/**
 * A leaf "pattern string" in our FbtInputTable that represents an Fbt UI text string.
 *
 * 1. the text can either be written in the build-in locale (en_US) or already translated
 * 2. Special token name patterns may be used. E.g. "Hello {yourName}" and need to be interpolated
 * to get a clear text.
 */
export type PatternString = string;

/**
 * An optional pattern hash bundled in leaf - aka the Fbt Hash.
 */
export type PatternHash = string;

export type FbtTableKey = string | number;
