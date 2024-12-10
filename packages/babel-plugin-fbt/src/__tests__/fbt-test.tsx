import { describe, expect, it } from '@jest/globals';
import {
  jsCodeFbtCallSerializer,
  snapshotTransform,
  withFbtRequireStatement,
} from './FbtTestUtil.tsx';

expect.addSnapshotSerializer(jsCodeFbtCallSerializer);

function runTest(
  data: { input: string; throws?: string },
  extra?: {
    extraOptions: Record<string, boolean | Record<string, boolean>>;
  }
) {
  const runSnapshotTransform = () => snapshotTransform(data.input, extra);
  if (typeof data.throws === 'string') {
    expect(runSnapshotTransform).toThrow(data.throws);
  } else {
    expect(runSnapshotTransform()).toMatchSnapshot();
  }
}

describe('fbt() API: ', () => {
  describe('using FBT subject', () => {
    it('should accept "subject" as a parameter', () => {
      runTest({
        input: withFbtRequireStatement(`fbt("Foo", "Bar", {subject: foo});`),
      });
    });
  });

  describe('using FBT subject with string templates', () => {
    it('should accept "subject" as a parameter', () => {
      runTest({
        input: withFbtRequireStatement('fbt(`Foo`, "Bar", {subject: foo});'),
      });
    });
  });
});

describe('Test double-lined params', () => {
  it('should remove the new line for param names that are two lines', () => {
    runTest({
      input: withFbtRequireStatement(
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
      ),
    });
  });
});

const describeFbtBindingTestCase = (requireStatement: string) => ({
  input: `${requireStatement};
      fbt("Foo", "Bar");`,
});

describe('fbt variable binding detection', () => {
  it(`should handle commonJS require()`, () => {
    runTest(describeFbtBindingTestCase(`const fbt = require('fbt')`));
  });

  describe('using ES6', () => {
    it(`should handle fbt default export`, () => {
      runTest(describeFbtBindingTestCase(`import fbt from 'fbt'`));
    });
    it(`should handle the named fbt export`, () => {
      runTest(describeFbtBindingTestCase(`import {fbt} from 'fbt'`));
    });
  });
});
