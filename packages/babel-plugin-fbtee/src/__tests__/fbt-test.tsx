import { describe, expect, it } from '@jest/globals';
import {
  jsCodeFbtCallSerializer,
  snapshotTransform,
  withFbtImportStatement,
} from './FbtTestUtil.tsx';

expect.addSnapshotSerializer(jsCodeFbtCallSerializer);

describe('fbt() API: ', () => {
  describe('using FBT subject', () => {
    it('should accept "subject" as a parameter', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement(`fbt("Foo", "Bar", {subject: foo});`),
        ),
      ).toMatchSnapshot();
    });
  });

  describe('using FBT subject with string templates', () => {
    it('should accept "subject" as a parameter', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement('fbt(`Foo`, "Bar", {subject: foo});'),
        ),
      ).toMatchSnapshot();
    });
  });
});

describe('Test double-lined params', () => {
  it('should remove the new line for param names that are two lines', () => {
    expect(
      snapshotTransform(
        withFbtImportStatement(
          `<fbt desc="d">
          <fbt:param
            name="two
                  lines">
            <b>
              <fbt desc="test">simple</fbt>
            </b>
          </fbt:param>
          test
        </fbt>`,
        ),
      ),
    ).toMatchSnapshot();
  });
});

const describeFbtBindingTestCase = (
  requireStatement: string,
) => `${requireStatement};
      fbt("Foo", "Bar");`;

describe('fbt variable binding detection', () => {
  it(`should handle commonJS require()`, () => {
    expect(
      snapshotTransform(
        describeFbtBindingTestCase(`const fbt = require('fbtee')`),
      ),
    ).toMatchSnapshot();
  });

  describe('using ES6', () => {
    it(`should handle fbt default export`, () => {
      expect(
        snapshotTransform(
          describeFbtBindingTestCase(`import fbt from 'fbtee'`),
        ),
      ).toMatchSnapshot();
    });
    it(`should handle the named fbt export`, () => {
      expect(
        snapshotTransform(
          describeFbtBindingTestCase(`import {fbt} from 'fbtee'`),
        ),
      ).toMatchSnapshot();
    });
  });
});

test('fragments inside of <fbt:param>', () => {
  expect(
    snapshotTransform(
      withFbtImportStatement(
        `<fbt desc="d">
          <fbt:param name="param">
            <>
              <b>Test</b>
              <fbt desc="test">simple</fbt>
            </>
          </fbt:param>
          test
        </fbt>`,
      ),
    ),
  ).toMatchSnapshot();
});
