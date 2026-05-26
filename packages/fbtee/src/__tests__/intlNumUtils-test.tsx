import { describe, expect, it } from '@jest/globals';
import Hooks from '../Hooks.tsx';
import intlNumUtils from '../intlNumUtils.tsx';
import setupFbtee from '../setupFbtee.tsx';
import IntlViewerContext from '../ViewerContext.tsx';

setupFbtee({
  translations: {},
});

function setLocale(locale: string) {
  Hooks.register({
    getViewerContext: () => ({ ...IntlViewerContext, locale }),
  });
}

describe('intlNumUtils:', () => {
  it('formats without grouping', () => {
    setLocale('en_US');

    expect(intlNumUtils.formatNumber(1234.5655, 2)).toBe('1234.57');
    expect(intlNumUtils.formatNumber(1234.1, 5)).toBe('1234.10000');
  });

  it('formats with locale grouping', () => {
    setLocale('en_US');

    expect(intlNumUtils.formatNumberWithThousandDelimiters(1234.5655, 2)).toBe(
      '1,234.57',
    );
    expect(intlNumUtils.formatNumberWithThousandDelimiters(1234.1, 5)).toBe(
      '1,234.10000',
    );
  });

  it('uses Intl locale data for decimal and grouping separators', () => {
    setLocale('pt_BR');

    expect(intlNumUtils.formatNumber(1234.56, 2)).toBe('1234,56');
    expect(intlNumUtils.formatNumberWithThousandDelimiters(1234.56, 2)).toBe(
      '1.234,56',
    );
  });

  it('uses Intl locale data for grouped numbering systems', () => {
    setLocale('hi_IN');

    expect(intlNumUtils.formatNumberWithThousandDelimiters(1_234_567.89)).toBe(
      '12,34,567.89',
    );
  });

  it('uses Intl locale data for native digits', () => {
    setLocale('fa_IR');

    expect(intlNumUtils.formatNumberWithThousandDelimiters(1_234_567.89)).toBe(
      new Intl.NumberFormat('fa-IR').format(1_234_567.89),
    );
  });
});
