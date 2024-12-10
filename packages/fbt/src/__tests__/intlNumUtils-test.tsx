import init from '../fbtInit';
import intlNumUtils from '../intlNumUtils';
import NumberFormatConsts, { NumberConfig } from '../NumberFormatConsts';

init({
  translations: {},
});

describe('intlNumUtils:', () => {
  let _overrides: Record<string, unknown> = {};

  function setup() {
    const _originalConfig = NumberFormatConsts.get();

    NumberFormatConsts.get = jest.fn(() => {
      return { ..._originalConfig, ..._overrides };
    });
  }

  function override(config: Partial<NumberConfig>) {
    setup();
    _overrides = config;
  }

  function prepareForAmericanFormat() {
    override({
      decimalSeparator: '.',
      minDigitsForThousandsSeparator: 4,
      numberDelimiter: ',',
      numberingSystemData: null,
      standardDecimalPatternInfo: {
        primaryGroupSize: 3,
        secondaryGroupSize: 3,
      },
    });
  }

  function prepareForBrazilianFormat() {
    override({
      decimalSeparator: ',',
      minDigitsForThousandsSeparator: 4,
      numberDelimiter: '.',
      numberingSystemData: null,
      standardDecimalPatternInfo: {
        primaryGroupSize: 3,
        secondaryGroupSize: 3,
      },
    });
  }

  const _hindiFormat = {
    decimalSeparator: '.',
    minDigitsForThousandsSeparator: 4,
    numberDelimiter: ',',
    numberingSystemData: null,
    standardDecimalPatternInfo: {
      primaryGroupSize: 3,
      secondaryGroupSize: 2,
    },
  } as const;

  function prepareForHindiLatinFormat() {
    override(_hindiFormat);
  }

  function prepareForHindiDevanagariFormat() {
    override({
      ..._hindiFormat,
      numberingSystemData: {
        digits: '\u0966\u0967\u0968\u0969\u096A\u096B\u096C\u096D\u096E\u096F',
      },
    });
  }

  function prepareForArabicFormat() {
    override({
      decimalSeparator: '\u066B',
      numberDelimiter: '\u066C',
      numberingSystemData: {
        digits: '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669',
      },
    });
  }

  function prepareForPersianFormat() {
    override({
      decimalSeparator: '\u066B',
      numberDelimiter: '\u066C',
      numberingSystemData: {
        digits: '\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9',
      },
    });
  }

  describe('intNumUtils.formatNumberRaw', () => {
    it('Should work with integer input', () => {
      expect(intlNumUtils.formatNumberRaw(5)).toBe('5');
      expect(intlNumUtils.formatNumberRaw(5, 3)).toBe('5.000');
    });

    it('Should work with string input', () => {
      expect(intlNumUtils.formatNumberRaw('5')).toBe('5');
      expect(intlNumUtils.formatNumberRaw('5', 3)).toBe('5.000');
    });

    it('Should not round when no decimals are specified', () => {
      expect(intlNumUtils.formatNumberRaw(5.499)).toBe('5.499');
      expect(intlNumUtils.formatNumberRaw(5.5)).toBe('5.5');
      expect(intlNumUtils.formatNumberRaw(5.499, null)).toBe('5.499');
      expect(intlNumUtils.formatNumberRaw(5.5, null)).toBe('5.5');

      expect(intlNumUtils.formatNumberRaw('5.499')).toBe('5.499');
      expect(intlNumUtils.formatNumberRaw('5.5')).toBe('5.5');
      expect(intlNumUtils.formatNumberRaw('5.499', null)).toBe('5.499');
      expect(intlNumUtils.formatNumberRaw('5.5', null)).toBe('5.5');
    });

    it('Should round (not truncate) decimals for numbers', () => {
      expect(intlNumUtils.formatNumberRaw(1234.5655, 2)).toBe('1234.57');
      expect(intlNumUtils.formatNumberRaw(1234.5644, 2)).toBe('1234.56');
      expect(intlNumUtils.formatNumberRaw(-1234.5655, 2)).toBe('-1234.57');
      expect(intlNumUtils.formatNumberRaw(-1234.5644, 2)).toBe('-1234.56');
    });

    it('Should truncate (not round) decimals for strings', () => {
      expect(intlNumUtils.formatNumberRaw('1234.5655', 2)).toBe('1234.56');
      expect(intlNumUtils.formatNumberRaw('1234.5644', 2)).toBe('1234.56');
      expect(intlNumUtils.formatNumberRaw('-1234.5655', 2)).toBe('-1234.56');
      expect(intlNumUtils.formatNumberRaw('-1234.5644', 2)).toBe('-1234.56');
    });

    it('Should handle a higher precision than given', () => {
      expect(intlNumUtils.formatNumberRaw(1234.1, 5)).toBe('1234.10000');
      expect(intlNumUtils.formatNumberRaw('1234.1', 5)).toBe('1234.10000');
    });

    it('Should respect delimiters passed', () => {
      expect(intlNumUtils.formatNumberRaw(1234.54, 2, '.', ',')).toBe(
        '1.234,54'
      );
      expect(intlNumUtils.formatNumberRaw('1234.54', 2, '.', ',')).toBe(
        '1.234,54'
      );
    });

    it('Should handle large numbers', () => {
      expect(intlNumUtils.formatNumberRaw('1000000000000000', 2)).toBe(
        '1000000000000000.00'
      );
      expect(intlNumUtils.formatNumberRaw('1000000000000000.123', 2)).toBe(
        '1000000000000000.12'
      );
      expect(intlNumUtils.formatNumberRaw('-1000000000000000.123', 2)).toBe(
        '-1000000000000000.12'
      );
    });

    it('Should handle small numbers', () => {
      expect(intlNumUtils.formatNumberRaw(0.000_000_199, 9)).toBe('1.99e-7');
      expect(intlNumUtils.formatNumberRaw(0.000_000_199, 7)).toBe('2e-7');
      expect(intlNumUtils.formatNumberRaw(0.000_000_019_9, 7)).toBe(
        '0.0000000'
      );
      expect(intlNumUtils.formatNumberRaw('0.000000199', 9)).toBe(
        '0.000000199'
      );
    });
  });

  describe('intNumUtils.formatNumber', () => {
    beforeEach(() => {
      prepareForAmericanFormat();
    });

    it('Should work with integer input', () => {
      expect(intlNumUtils.formatNumber(5)).toBe('5');
      expect(intlNumUtils.formatNumber(5, 3)).toBe('5.000');
    });

    it('Should not round when no decimals are specified', () => {
      expect(intlNumUtils.formatNumber(5.499)).toBe('5.499');
      expect(intlNumUtils.formatNumber(5.5)).toBe('5.5');
      expect(intlNumUtils.formatNumber(5.499, null)).toBe('5.499');
      expect(intlNumUtils.formatNumber(5.5, null)).toBe('5.5');
    });

    it('Should round (not truncate) decimals', () => {
      expect(intlNumUtils.formatNumber(1234.5655, 2)).toBe('1234.57');
      expect(intlNumUtils.formatNumber(1234.5644, 2)).toBe('1234.56');
      expect(intlNumUtils.formatNumber(-1234.5655, 2)).toBe('-1234.57');
      expect(intlNumUtils.formatNumber(-1234.5644, 2)).toBe('-1234.56');
    });

    it('Should handle a higher precision than given', () => {
      expect(intlNumUtils.formatNumber(1234.1, 5)).toBe('1234.10000');
    });

    it('Should respect user locale for number formatting', () => {
      override({
        decimalSeparator: '#',
        minDigitsForThousandsSeparator: 6,
        numberDelimiter: '/',
      });

      // Below the thousand separator threshold. No thousand separator.
      expect(intlNumUtils.formatNumber(1234.1, 1)).toBe('1234#1');
      expect(intlNumUtils.formatNumber(12_345.1, 1)).toBe('12345#1');
      // Above the thousand separator threshold.
      expect(intlNumUtils.formatNumber(123_456.1, 1)).toBe('123456#1');

      // Clean up.
      jest.resetModules();
    });
  });

  describe('intNumUtils.formatNumberWithThousandDelimiters', () => {
    beforeEach(() => {
      prepareForAmericanFormat();
    });

    it('Should work with integer input', () => {
      expect(intlNumUtils.formatNumberWithThousandDelimiters(5)).toBe('5');
      expect(intlNumUtils.formatNumberWithThousandDelimiters(5, 3)).toBe(
        '5.000'
      );
    });

    it('Should not round when no decimals are specified', () => {
      expect(intlNumUtils.formatNumberWithThousandDelimiters(5.499)).toBe(
        '5.499'
      );
      expect(intlNumUtils.formatNumberWithThousandDelimiters(5.5)).toBe('5.5');
      expect(intlNumUtils.formatNumberWithThousandDelimiters(5.499, null)).toBe(
        '5.499'
      );
      expect(intlNumUtils.formatNumberWithThousandDelimiters(5.5, null)).toBe(
        '5.5'
      );
    });

    it('Should round (not truncate) decimals', () => {
      expect(
        intlNumUtils.formatNumberWithThousandDelimiters(1234.5655, 2)
      ).toBe('1,234.57');
      expect(
        intlNumUtils.formatNumberWithThousandDelimiters(1234.5644, 2)
      ).toBe('1,234.56');
      expect(
        intlNumUtils.formatNumberWithThousandDelimiters(-1234.5655, 2)
      ).toBe('-1,234.57');
      expect(
        intlNumUtils.formatNumberWithThousandDelimiters(-1234.5644, 2)
      ).toBe('-1,234.56');
    });

    it('Should handle a higher precision than given', () => {
      expect(intlNumUtils.formatNumberWithThousandDelimiters(1234.1, 5)).toBe(
        '1,234.10000'
      );
    });

    it('Should respect primary and secondary grouping sizes in Hindi', () => {
      prepareForHindiLatinFormat();
      expect(intlNumUtils.formatNumberWithThousandDelimiters(12)).toBe('12');
      expect(intlNumUtils.formatNumberWithThousandDelimiters(1234)).toBe(
        '1,234'
      );
      expect(intlNumUtils.formatNumberWithThousandDelimiters(12_345)).toBe(
        '12,345'
      );
      expect(intlNumUtils.formatNumberWithThousandDelimiters(123_456)).toBe(
        '1,23,456'
      );
      expect(intlNumUtils.formatNumberWithThousandDelimiters(1_234_567.1)).toBe(
        '12,34,567.1'
      );
      jest.resetModules();
    });

    it('Should render native digits when available', () => {
      prepareForHindiDevanagariFormat();
      expect(intlNumUtils.formatNumberWithThousandDelimiters(0)).toBe('\u0966');
      expect(intlNumUtils.formatNumberWithThousandDelimiters(1234)).toBe(
        '\u0967,\u0968\u0969\u096A'
      );
      expect(intlNumUtils.formatNumberWithThousandDelimiters(12_345)).toBe(
        '\u0967\u0968,\u0969\u096A\u096B'
      );
      expect(intlNumUtils.formatNumberWithThousandDelimiters(123_456)).toBe(
        '\u0967,\u0968\u0969,\u096A\u096B\u096C'
      );
      expect(intlNumUtils.formatNumberWithThousandDelimiters(1_234_567.1)).toBe(
        '\u0967\u0968,\u0969\u096A,\u096B\u096C\u096D.\u0967'
      );
      jest.resetModules();
    });

    it('Should respect user locale for number formatting', () => {
      override({
        decimalSeparator: '#',
        minDigitsForThousandsSeparator: 6,
        numberDelimiter: '/',
      });

      // Below the thousand separator threshold. No thousand separator.
      expect(intlNumUtils.formatNumberWithThousandDelimiters(1234.1, 1)).toBe(
        '1234#1'
      );
      expect(intlNumUtils.formatNumberWithThousandDelimiters(12_345.1, 1)).toBe(
        '12345#1'
      );
      // Above the thousand separator threshold.
      expect(
        intlNumUtils.formatNumberWithThousandDelimiters(123_456.1, 1)
      ).toBe('123/456#1');

      // Clean up.
      jest.resetModules();
    });
  });

  describe('intlNumUtils.formatNumberWithLimitedSigFig', () => {
    beforeEach(() => {
      prepareForAmericanFormat();
    });

    it('Should format number in significant figures and decimals', () => {
      expect(
        intlNumUtils.formatNumberWithLimitedSigFig(123_456_789, 0, 2)
      ).toBe('120,000,000');
      expect(
        intlNumUtils.formatNumberWithLimitedSigFig(1.234_567_89, 2, 2)
      ).toBe('1.20');
      expect(intlNumUtils.formatNumberWithLimitedSigFig(-12.345, 3, 3)).toBe(
        '-12.300'
      );
      expect(intlNumUtils.formatNumberWithLimitedSigFig(0, null, 3)).toBe(
        '0.00'
      );
    });
  });

  describe('intlNumUtils.parseNumberRaw', () => {
    beforeEach(() => {
      prepareForAmericanFormat();
    });

    it('Should return null for non-numeric input', () => {
      expect(intlNumUtils.parseNumber('')).toBe(null);
      expect(intlNumUtils.parseNumber('asdf')).toBe(null);
    });

    it('Should infer the decimal symbol (period)', () => {
      expect(intlNumUtils.parseNumber('0')).toBe(0);
      expect(intlNumUtils.parseNumber('100.00')).toBe(100);
      expect(intlNumUtils.parseNumber('$ 100.00')).toBe(100);
      expect(intlNumUtils.parseNumber('100,000.00')).toBe(100_000);
      expect(intlNumUtils.parseNumber('$100,000.00')).toBe(100_000);
      expect(intlNumUtils.parseNumber('1,00,0,00.00')).toBe(100_000); // malformed but OK
      expect(intlNumUtils.parseNumber('-100,000.00')).toBe(-100_000);
      expect(intlNumUtils.parseNumber('-$100,000.00')).toBe(-100_000);
      expect(intlNumUtils.parseNumber('100.')).toBe(100); // No decimal digits
      expect(intlNumUtils.parseNumber('0.123')).toBe(0.123);
      expect(intlNumUtils.parseNumber('US 2.13')).toBe(2.13);
      expect(intlNumUtils.parseNumber('2.13 TL')).toBe(2.13);
      expect(intlNumUtils.parseNumber('123,456,789')).toBe(123_456_789); // 2+ ','s
      expect(intlNumUtils.parseNumber('123,456,789,123')).toBe(123_456_789_123); // longer
      expect(intlNumUtils.parseNumber('123,456,789,')).toBe(123_456_789); // trailing ,
      expect(intlNumUtils.parseNumber('123,456.785')).toBe(123_456.785); // decimal
      expect(intlNumUtils.parseNumber('-123,456,789')).toBe(-123_456_789);
    });

    it('Should respect the decimal symbol passed', () => {
      expect(intlNumUtils.parseNumberRaw('100,235', ',')).toBe(100.235);
      expect(intlNumUtils.parseNumberRaw('100,', ',')).toBe(100); // No decimal digits
      expect(intlNumUtils.parseNumberRaw('123.456.789', ',', '.')).toBe(
        123_456_789
      ); // 2+ '.'s
      expect(intlNumUtils.parseNumberRaw('123.456.789.123', ',', '.')).toBe(
        123_456_789_123
      ); // long
      expect(intlNumUtils.parseNumberRaw('123.456.789.', ',', '.')).toBe(
        123_456_789
      ); // trailing .
      expect(intlNumUtils.parseNumberRaw('-123.456.789', ',', '.')).toBe(
        -123_456_789
      ); // negative
      expect(intlNumUtils.parseNumberRaw('123.456,785', ',', '.')).toBe(
        123_456.785
      ); // decimal
      expect(intlNumUtils.parseNumberRaw('300,02,000 132', ' ', ',')).toBe(
        30_002_000.132
      ); // space
    });

    it('Should support Spanish thousand delimiters (spaces)', () => {
      expect(intlNumUtils.parseNumberRaw('123 456 789', '.')).toBe(123_456_789);
      expect(intlNumUtils.parseNumberRaw('123 456 789', ',')).toBe(123_456_789);
      expect(intlNumUtils.parseNumberRaw('1 234,56', ',')).toBe(1234.56);
    });
  });

  describe('intlNumUtils.parseNumber', () => {
    beforeEach(() => {
      prepareForAmericanFormat();
    });

    it('Should parse numbers with English delimiters', () => {
      expect(intlNumUtils.parseNumber('0')).toBe(0);
      expect(intlNumUtils.parseNumber('100.00')).toBe(100);
      expect(intlNumUtils.parseNumber('$ 100.00')).toBe(100);
      expect(intlNumUtils.parseNumber('100,000.00')).toBe(100_000);
      expect(intlNumUtils.parseNumber('$100,000.00')).toBe(100_000);
      expect(intlNumUtils.parseNumber('1,00,0,00.00')).toBe(100_000); // malformed but OK
      expect(intlNumUtils.parseNumber('-100,000.00')).toBe(-100_000);
      expect(intlNumUtils.parseNumber('-$100,000.00')).toBe(-100_000);
      expect(intlNumUtils.parseNumber('100.')).toBe(100); // No decimal digits
      expect(intlNumUtils.parseNumber('0.123')).toBe(0.123);
      expect(intlNumUtils.parseNumber('US 2.13')).toBe(2.13);
      expect(intlNumUtils.parseNumber('2.13 TL')).toBe(2.13);
      expect(intlNumUtils.parseNumber('123,456,789')).toBe(123_456_789); // 2+ ','s
      expect(intlNumUtils.parseNumber('123,456,789,123')).toBe(123_456_789_123); // longer
      expect(intlNumUtils.parseNumber('123,456,789,')).toBe(123_456_789); // trailing ,
      expect(intlNumUtils.parseNumber('123,456.785')).toBe(123_456.785); // decimal
      expect(intlNumUtils.parseNumber('-123,456,789')).toBe(-123_456_789);
    });

    it('Should parse numbers with French/German/etc. delimiters', () => {
      prepareForBrazilianFormat();

      expect(intlNumUtils.parseNumber('100,00')).toBe(100);
      expect(intlNumUtils.parseNumber('$ 100,00')).toBe(100);
      expect(intlNumUtils.parseNumber('100.000,00')).toBe(100_000);
      expect(intlNumUtils.parseNumber('$100.000,00')).toBe(100_000);
      expect(intlNumUtils.parseNumber('1.00.0.00,00')).toBe(100_000); // malformed but OK
      expect(intlNumUtils.parseNumber('-100.000,00')).toBe(-100_000);
      expect(intlNumUtils.parseNumber('-$100.000,00')).toBe(-100_000);
      expect(intlNumUtils.parseNumber('100,')).toBe(100); // No decimal digits
      expect(intlNumUtils.parseNumber('0,123')).toBe(0.123);
      expect(intlNumUtils.parseNumber('US 2,13')).toBe(2.13);
      expect(intlNumUtils.parseNumber('2,13 TL')).toBe(2.13);
      expect(intlNumUtils.parseNumber('123.456.789')).toBe(123_456_789); // 2+ '.'s
      expect(intlNumUtils.parseNumber('123.456.789.123')).toBe(123_456_789_123); // longer
      expect(intlNumUtils.parseNumber('123.456.789.')).toBe(123_456_789); // trailing .
      expect(intlNumUtils.parseNumber('123.456,785')).toBe(123_456.785); // decimal
      expect(intlNumUtils.parseNumber('-123.456.789')).toBe(-123_456_789);
    });

    it('Should parse numbers including Peruvian and Russian currency', () => {
      expect(intlNumUtils.parseNumber('S/. 450.00')).toBe(450);
      expect(intlNumUtils.parseNumber('S/..45')).toBe(0.45);
      expect(intlNumUtils.parseNumber('p. 450.00')).toBe(450);
      expect(intlNumUtils.parseNumber('p..45')).toBe(0.45);
      expect(intlNumUtils.parseNumber('450.00p.')).toBe(450);
      expect(intlNumUtils.parseNumber('45p.')).toBe(45);
      expect(intlNumUtils.parseNumber('.45p.')).toBe(0.45);

      prepareForBrazilianFormat();

      expect(intlNumUtils.parseNumber('S/.,45')).toBe(0.45);
    });

    it('Should parse numbers starting with currency separator', () => {
      expect(intlNumUtils.parseNumber('.75')).toBe(0.75);
      expect(intlNumUtils.parseNumber('.75942345')).toBe(0.759_423_45);

      prepareForBrazilianFormat();

      expect(intlNumUtils.parseNumber(',75')).toBe(0.75);
      expect(intlNumUtils.parseNumber(',75942345')).toBe(0.759_423_45);
    });

    it('Should parse numbers with Arabic keyboard input characters', () => {
      prepareForArabicFormat();
      // test cases that use \u066b as decimal separator
      expect(intlNumUtils.parseNumber('\u0660\u066b\u0661\u0662\u0663')).toBe(
        0.123
      );
      expect(
        intlNumUtils.parseNumber(
          '\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669\u0660'
        )
      ).toBe(1_234_567_890); // all digits
      expect(
        intlNumUtils.parseNumber(
          '\u0661\u0662\u0663\u066C\u0664\u0665\u0666\u066C' +
            '\u0667\u0668\u0669\u066C\u0661\u0662\u0663\u0660'
        )
      ).toBe(1_234_567_891_230); // longer
      expect(
        intlNumUtils.parseNumber(
          '\u0661\u0662\u0663\u066C\u0664\u0665\u0666\u066C\u0667\u0668\u0669\u066C'
        )
      ).toBe(123_456_789); // trailing .
      expect(
        intlNumUtils.parseNumber(
          '\u0661\u0662\u0663\u066C\u0664\u0665\u0666\u066b\u0667\u0668\u0669'
        )
      ).toBe(123_456.789); // decimal
      expect(
        intlNumUtils.parseNumber(
          '-\u0661\u0662\u0663\u066C\u0664\u0665\u0666\u066C\u0667\u0668\u0669'
        )
      ).toBe(-123_456_789);

      expect(intlNumUtils.parseNumber('\u0660\u066b\u0661\u0662\u0663')).toBe(
        0.123
      );
      expect(
        intlNumUtils.parseNumber(
          '\u0661\u0662\u0663\u066c\u0664\u0665\u0666\u066b\u0667\u0668\u0669'
        )
      ).toBe(123_456.789); // decimal

      // Clean up.
      jest.resetModules();
    });

    it('Should parse numbers with Persian keyboard input characters', () => {
      prepareForPersianFormat();
      // Persian characters
      expect(intlNumUtils.parseNumber('\u06f0\u066B\u06f1\u06f2\u06f3')).toBe(
        0.123
      );
      expect(
        intlNumUtils.parseNumber(
          '\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9\u06f0'
        )
      ).toBe(1_234_567_890); // all digits
      expect(
        intlNumUtils.parseNumber(
          '\u06f1\u06f2\u06f3\u066C\u06f4\u06f5\u06f6\u066C\u06f7\u06f8\u06f9\u066C' +
            '\u06f1\u06f2\u06f3\u06f0'
        )
      ).toBe(1_234_567_891_230); // longer
      expect(
        intlNumUtils.parseNumber(
          '\u06f1\u06f2\u06f3\u066C\u06f4\u06f5\u06f6\u066C\u06f7\u06f8\u06f9\u066C'
        )
      ).toBe(123_456_789); // trailing .
      expect(
        intlNumUtils.parseNumber(
          '\u06f1\u06f2\u06f3\u066C\u06f4\u06f5\u06f6\u066B\u06f7\u06f8\u06f5'
        )
      ).toBe(123_456.785); // decimal
      expect(
        intlNumUtils.parseNumber(
          '-\u06f1\u06f2\u06f3\u066C\u06f4\u06f5\u06f6\u066C\u06f7\u06f8\u06f9'
        )
      ).toBe(-123_456_789);

      // Clean up.
      jest.resetModules();
    });
  });

  describe('intlNumUtils.parseNumber with Parser', () => {
    beforeEach(() => {
      prepareForAmericanFormat();
    });

    it('Parser should handle symbols with dot nicely', () => {
      expect(intlNumUtils.parseNumber('S/. 450.00')).toBe(450);
      expect(intlNumUtils.parseNumber('S/..45')).toBe(0.45);
      expect(intlNumUtils.parseNumber('p. 450.00')).toBe(450);
      expect(intlNumUtils.parseNumber('fake.45')).toBe(0.45);
      expect(intlNumUtils.parseNumber('p..45')).toBe(0.45);
      expect(intlNumUtils.parseNumber('450.00p.')).toBe(450);
      expect(intlNumUtils.parseNumber('45p.')).toBe(45);
      expect(intlNumUtils.parseNumber('.45p.')).toBe(0.45);

      expect(intlNumUtils.parseNumber('.75')).toBe(0.75);
      expect(intlNumUtils.parseNumber('.75942345')).toBe(0.759_423_45);
    });

    it('Parser should ignore spaces as much as possible', () => {
      expect(intlNumUtils.parseNumberRaw('123 456 789', '.')).toBe(123_456_789);
      expect(intlNumUtils.parseNumberRaw('123 456 789', ',')).toBe(123_456_789);
      expect(intlNumUtils.parseNumberRaw('1 234,56', ',')).toBe(1234.56);
    });

    it('Should parse American format correctly with Parser', () => {
      expect(intlNumUtils.parseNumber('0')).toBe(0);
      expect(intlNumUtils.parseNumber('100.00')).toBe(100);
      expect(intlNumUtils.parseNumber('$ 100.00')).toBe(100);
      expect(intlNumUtils.parseNumber('100,000.00')).toBe(100_000);
      expect(intlNumUtils.parseNumber('$100,000.00')).toBe(100_000);
      expect(intlNumUtils.parseNumber('1,00,0,00.00')).toBe(100_000); // malformed but OK
      expect(intlNumUtils.parseNumber('-100,000.00')).toBe(-100_000);
      expect(intlNumUtils.parseNumber('-$100,000.00')).toBe(-100_000);
      expect(intlNumUtils.parseNumber('100.')).toBe(100); // No decimal digits
      expect(intlNumUtils.parseNumber('0.123')).toBe(0.123);
      expect(intlNumUtils.parseNumber('US 2.13')).toBe(2.13);
      expect(intlNumUtils.parseNumber('2.13 TL')).toBe(2.13);
      expect(intlNumUtils.parseNumber('123,456,789')).toBe(123_456_789); // 2+ ','s
      expect(intlNumUtils.parseNumber('123,456,789,123')).toBe(123_456_789_123); // longer
      expect(intlNumUtils.parseNumber('123,456,789,')).toBe(123_456_789); // trailing ,
      expect(intlNumUtils.parseNumber('123,456.785')).toBe(123_456.785); // decimal
      expect(intlNumUtils.parseNumber('-123,456,789')).toBe(-123_456_789);
    });

    it('Parser should handle Brazilian format properly', () => {
      prepareForBrazilianFormat();

      expect(intlNumUtils.parseNumber('100,00')).toBe(100);
      expect(intlNumUtils.parseNumber('$ 100,00')).toBe(100);
      expect(intlNumUtils.parseNumber('100.000,00')).toBe(100_000);
      expect(intlNumUtils.parseNumber('$100.000,00')).toBe(100_000);
      expect(intlNumUtils.parseNumber('1.00.0.00,00')).toBe(100_000); // malformed but OK
      expect(intlNumUtils.parseNumber('-100.000,00')).toBe(-100_000);
      expect(intlNumUtils.parseNumber('-$100.000,00')).toBe(-100_000);
      expect(intlNumUtils.parseNumber('100,')).toBe(100); // No decimal digits
      expect(intlNumUtils.parseNumber('0,123')).toBe(0.123);
      expect(intlNumUtils.parseNumber('US 2,13')).toBe(2.13);
      expect(intlNumUtils.parseNumber('2,13 TL')).toBe(2.13);
      expect(intlNumUtils.parseNumber('123.456.789')).toBe(123_456_789); // 2+ '.'s
      expect(intlNumUtils.parseNumber('123.456.789.123')).toBe(123_456_789_123); // longer
      expect(intlNumUtils.parseNumber('123.456.789.')).toBe(123_456_789); // trailing .
      expect(intlNumUtils.parseNumber('123.456,785')).toBe(123_456.785); // decimal
      expect(intlNumUtils.parseNumber('-123.456.789')).toBe(-123_456_789);
    });

    it('Parser should not handle pathological cases', () => {
      expect(intlNumUtils.parseNumber('-100-,0%*#$00.00')).toBe(null); // unforgiving
      expect(intlNumUtils.parseNumber('-$100-,0$!@#00.00')).toBe(null); // unforgiving
      expect(intlNumUtils.parseNumberRaw('1.45.345', '.')).toBe(null);
      expect(intlNumUtils.parseNumberRaw('1,45,345', ',')).toBe(null);
    });

    it('Parser should handle currencies with dots', () => {
      expect(intlNumUtils.parseNumber('kr.2000')).toBe(2000);
      expect(intlNumUtils.parseNumber('\u0631.\u0633.2000')).toBe(2000);
      expect(intlNumUtils.parseNumber('S/.2000')).toBe(2000);
      expect(intlNumUtils.parseNumber('S.2000')).toBe(0.2);
    });
  });
});
