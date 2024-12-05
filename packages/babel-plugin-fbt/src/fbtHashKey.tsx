import fbtJenkinsHash from './fbtJenkinsHash';
import type { TableJSFBTTree } from './index';

const BaseNSymbols =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Compute the baseN string for a given unsigned integer.
function uintToBaseN(numberArg: number, base: number) {
  let number = numberArg;
  if (base < 2 || base > 62 || number < 0) {
    return '';
  }
  let output = '';
  do {
    output = BaseNSymbols.charAt(number % base).concat(output);
    number = Math.floor(number / base);
  } while (number > 0);
  return output;
}

export default function fbtHashKey(jsfbt: Readonly<TableJSFBTTree>): string {
  return uintToBaseN(fbtJenkinsHash(jsfbt), 62);
}
