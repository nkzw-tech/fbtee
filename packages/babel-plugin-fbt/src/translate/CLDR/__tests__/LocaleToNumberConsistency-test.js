/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 */

import assert from 'assert';
import TestData_IntlNumberType from '../__data__/TestData_IntlNumberType';
import IntlNumberType from '../IntlNumberType';

describe('Test Fbt Enum', () => {
  it('Should maintain consistency with server-side locale data', () => {
    for (const locale in TestData_IntlNumberType) {
      const expected = require('../' + TestData_IntlNumberType[locale]).default;
      const actual = IntlNumberType._getNumberModuleForLocale(locale);
      if (actual !== expected) {
        throw new assert.AssertionError({
          message:
            'Expected: `' +
            expected +
            '`. Actual: `' +
            actual +
            '` on locale: ' +
            locale,
          actual,
          expected,
        });
      }
    }
  });
});
