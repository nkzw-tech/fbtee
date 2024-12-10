import { describe, expect, it } from '@jest/globals';
import escapeRegex from '../escapeRegex.tsx';

describe('escapeRegex', () => {
  it('escapes individual special characters', () => {
    expect(escapeRegex('.')).toBe(String.raw`\.`);
    expect(escapeRegex('\\')).toBe('\\\\');
    expect(escapeRegex('[')).toBe(String.raw`\[`);
    expect(escapeRegex(']')).toBe(String.raw`\]`);
    expect(escapeRegex('(')).toBe(String.raw`\(`);
    expect(escapeRegex(')')).toBe(String.raw`\)`);
    expect(escapeRegex('{')).toBe(String.raw`\{`);
    expect(escapeRegex('}')).toBe(String.raw`\}`);
    expect(escapeRegex('^')).toBe(String.raw`\^`);
    expect(escapeRegex('$')).toBe(String.raw`\$`);
    expect(escapeRegex('-')).toBe(String.raw`\-`);
    expect(escapeRegex('|')).toBe(String.raw`\|`);
    expect(escapeRegex('?')).toBe(String.raw`\?`);
    expect(escapeRegex('*')).toBe(String.raw`\*`);
    expect(escapeRegex('+')).toBe(String.raw`\+`);
  });

  it("doesn't change characters that have escape sequences", () => {
    expect(escapeRegex('\n')).toBe('\n');
    expect(escapeRegex('\t')).toBe('\t');
    expect(escapeRegex('\b')).toBe('\b');
    expect(escapeRegex('\f')).toBe('\f');
    expect(escapeRegex('\v')).toBe('\v');
    expect(escapeRegex('\r')).toBe('\r');
    expect(escapeRegex('\0')).toBe('\0');
  });

  it('escapes multiple special characters', () => {
    expect(escapeRegex('hello? good-bye...')).toBe(
      String.raw`hello\? good\-bye\.\.\.`
    );
    expect(escapeRegex('1 + 1 * 3 - 2 = 2')).toBe(
      String.raw`1 \+ 1 \* 3 \- 2 = 2`
    );
    expect(escapeRegex('[]{}()')).toBe(String.raw`\[\]\{\}\(\)`);
  });

  it("doesn't change non-special characters", () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    expect(escapeRegex(alphabet)).toBe(alphabet);

    const digits = '0123456789';
    expect(escapeRegex(digits)).toBe(digits);

    const punctuation = '~`!@#%&_=:;"\'<>,/';
    expect(escapeRegex(punctuation)).toBe(punctuation);
  });
});
