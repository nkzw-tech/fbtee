/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @noflow
 */

'use strict';

import FbtNumberConsistency from '../__mocks__/FbtNumberConsistency';

describe('FbtNumber consistency', function () {
  FbtNumberConsistency.dataModuleNames.forEach((dataModuleName) => {
    const path = require.resolve('../__mocks__/' + dataModuleName);
    const dataModule = require(path);
    const jsModulePath = require.resolve('../' + dataModule.jsModule);
    const jsModule = require(jsModulePath).default;
    const phpNumberTypes = dataModule.numberTypes;
    it('should be consistent with PHP in ' + dataModuleName, function () {
      for (let ii = 0; ii < phpNumberTypes.length; ++ii) {
        let jsType = jsModule.getVariation(ii);
        // In JS, we still have a table access (although there is only
        // one entry)
        jsType = jsType === '*' ? null : jsType;
        expect(jsType).toBe(
          phpNumberTypes[ii],
          ii + ' failed in ' + dataModuleName
        );
      }
    });
  });
});
