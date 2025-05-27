import { describe, expect, it } from '@jest/globals';
import { dedupeStops } from '../IntlPunctuation.tsx';

const FW_Q_MARK = '\u{ff1f}';
const FW_BANG = '\u{ff01}';
const HINDI_FS = '\u{0964}';
const MYANMAR_FS = '\u{104B}';
const CJK_FS = '\u{3002}';
const ELLIP = '\u{2026}';
const THAI_ELLIP = '\u{0e2f}';
const LAOTIAN_ELLIP = '\u{0eaf}';
const MONGOLIAN_ELLIP = '\u{1801}';

describe('IntlPunctuation', () => {
  it('strips redundant stops', () => {
    const expected = {
      '!': ['!', FW_BANG, '?', FW_Q_MARK, '.', HINDI_FS, MYANMAR_FS, CJK_FS],
      '?': [
        '?',
        FW_Q_MARK,
        '.',
        HINDI_FS,
        MYANMAR_FS,
        CJK_FS,
        '!',
        FW_BANG,
        ELLIP,
        THAI_ELLIP,
        LAOTIAN_ELLIP,
        MONGOLIAN_ELLIP,
      ],
      '.': ['.', HINDI_FS, MYANMAR_FS, CJK_FS, '!', FW_BANG],
      [CJK_FS]: ['.', HINDI_FS, MYANMAR_FS, CJK_FS, '!', FW_BANG],
      [ELLIP]: [
        ELLIP,
        THAI_ELLIP,
        LAOTIAN_ELLIP,
        MONGOLIAN_ELLIP,
        '.',
        HINDI_FS,
        MYANMAR_FS,
        CJK_FS,
        '!',
        FW_BANG,
      ],
      [FW_BANG]: [
        '!',
        FW_BANG,
        '?',
        FW_Q_MARK,
        '.',
        HINDI_FS,
        MYANMAR_FS,
        CJK_FS,
      ],
      [FW_Q_MARK]: [
        '?',
        FW_Q_MARK,
        '.',
        HINDI_FS,
        MYANMAR_FS,
        CJK_FS,
        '!',
        FW_BANG,
        ELLIP,
        THAI_ELLIP,
        LAOTIAN_ELLIP,
        MONGOLIAN_ELLIP,
      ],
      [HINDI_FS]: ['.', HINDI_FS, MYANMAR_FS, CJK_FS, '!', FW_BANG],
      [LAOTIAN_ELLIP]: [
        ELLIP,
        THAI_ELLIP,
        LAOTIAN_ELLIP,
        MONGOLIAN_ELLIP,
        '.',
        HINDI_FS,
        MYANMAR_FS,
        CJK_FS,
        '!',
        FW_BANG,
      ],
      [MONGOLIAN_ELLIP]: [
        ELLIP,
        THAI_ELLIP,
        LAOTIAN_ELLIP,
        MONGOLIAN_ELLIP,
        '.',
        HINDI_FS,
        MYANMAR_FS,
        CJK_FS,
        '!',
        FW_BANG,
      ],
      [MYANMAR_FS]: ['.', HINDI_FS, MYANMAR_FS, CJK_FS, '!', FW_BANG],
      [THAI_ELLIP]: [
        ELLIP,
        THAI_ELLIP,
        LAOTIAN_ELLIP,
        MONGOLIAN_ELLIP,
        '.',
        HINDI_FS,
        MYANMAR_FS,
        CJK_FS,
        '!',
        FW_BANG,
      ],
    } as const;
    for (const prefix of Object.keys(expected)) {
      for (const suffix of expected[
        prefix as unknown as keyof typeof expected
      ]) {
        const result = dedupeStops(prefix, suffix);
        expect({ prefix, result, suffix }).toEqual({
          prefix,
          result: '',
          suffix,
        });
      }
    }
  });

  it("doesn't strip stops it shouldn't", () => {
    expect(dedupeStops('.', '?')).toEqual('?');
  });
});
