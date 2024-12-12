import { describe, expect, it } from '@jest/globals';
import {
  jsCodeFbtCallSerializer,
  snapshotTransform,
  withFbtRequireStatement,
} from './FbtTestUtil.tsx';

expect.addSnapshotSerializer(jsCodeFbtCallSerializer);

describe('fbt() API: ', () => {
  describe('using FBT subject', () => {
    it('should accept "subject" as a parameter', () => {
      expect(
        snapshotTransform(
          withFbtRequireStatement(`fbt("Foo", "Bar", {subject: foo});`)
        )
      ).toMatchSnapshot();
    });
  });

  describe('using FBT subject with string templates', () => {
    it('should accept "subject" as a parameter', () => {
      expect(
        snapshotTransform(
          withFbtRequireStatement('fbt(`Foo`, "Bar", {subject: foo});')
        )
      ).toMatchSnapshot();
    });
  });
});

describe('Test double-lined params', () => {
  it('should remove the new line for param names that are two lines', () => {
    expect(
      snapshotTransform(
        withFbtRequireStatement(
          `<fbt desc="d">
          <fbt:param
            name="two
                  lines">
            <b>
              <fbt desc="test">simple</fbt>
            </b>
          </fbt:param>
          test
        </fbt>`
        )
      )
    ).toMatchSnapshot();
  });
});

const describeFbtBindingTestCase = (
  requireStatement: string
) => `${requireStatement};
      fbt("Foo", "Bar");`;

describe('fbt variable binding detection', () => {
  it(`should handle commonJS require()`, () => {
    expect(
      snapshotTransform(
        describeFbtBindingTestCase(`const fbt = require('fbtee')`)
      )
    ).toMatchSnapshot();
  });

  describe('using ES6', () => {
    it(`should handle fbt default export`, () => {
      expect(
        snapshotTransform(describeFbtBindingTestCase(`import fbt from 'fbtee'`))
      ).toMatchSnapshot();
    });
    it(`should handle the named fbt export`, () => {
      expect(
        snapshotTransform(
          describeFbtBindingTestCase(`import {fbt} from 'fbtee'`)
        )
      ).toMatchSnapshot();
    });
  });
});
