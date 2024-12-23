import { ReactElement } from 'react';
import fbs from './fbs.tsx';
import intlNumUtils from './intlNumUtils.tsx';

// Ensure the local version of `fbs` is used instead of auto-importing `fbtee`.
// eslint-disable-next-line no-unused-expressions, @typescript-eslint/no-unused-expressions
fbs;

function formatNumber(value: number, decimals?: number | null): string {
  return intlNumUtils.formatNumber(value, decimals);
}

function getAtLeastString(
  maxNumber: number,
  decimals?: number | null,
): ReactElement {
  // after we start using CLDR data, it will not be fbt anymore.
  return (
    <fbs desc="Label with meaning 'at least number'" project="locale_data">
      <fbs:param name="number" number={maxNumber}>
        {intlNumUtils.formatNumberWithThousandDelimiters(maxNumber, decimals)}
      </fbs:param>
      {'+'}
    </fbs>
  );
}

function getLessThanString(
  minNumber: number,
  decimals?: number | null,
): ReactElement {
  // after we start using CLDR data, it will not be fbt anymore.
  return (
    <fbs desc="Label with meaning 'less than number'" project="locale_data">
      {'<'}
      <fbs:param name="number" number={minNumber}>
        {intlNumUtils.formatNumberWithThousandDelimiters(minNumber, decimals)}
      </fbs:param>
    </fbs>
  );
}

function formatNumberWithMaxLimit(
  value: number,
  maxvalue: number,
  decimals?: number | null,
): ReactElement | string {
  return value > maxvalue
    ? getAtLeastString(maxvalue, decimals)
    : intlNumUtils.formatNumberWithThousandDelimiters(value, decimals);
}

function formatNumberWithMinLimit(
  value: number,
  minvalue: number,
  decimals?: number | null,
): ReactElement | string {
  return value < minvalue
    ? getLessThanString(minvalue, decimals)
    : intlNumUtils.formatNumberWithThousandDelimiters(value, decimals);
}

formatNumber.withThousandDelimiters =
  intlNumUtils.formatNumberWithThousandDelimiters;
formatNumber.withMaxLimit = formatNumberWithMaxLimit;
formatNumber.withMinLimit = formatNumberWithMinLimit;

export default formatNumber;
