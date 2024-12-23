import { describe, expect, it } from '@jest/globals';
import { getChildToParentRelationships } from '../index.tsx';
import { transform, withFbtImportStatement } from './FbtTestUtil.tsx';

const testChildToParentRelationships = ([, testData]: readonly [
  name: string,
  { input: string; output: Map<number, number> },
]) => {
  transform(testData.input.replace(/\/\*\*(?:\/|[^*]|\*+[^*/])*\*+\//, ''), {
    collectFbt: true,
  });
  expect(testData.output).toEqual(getChildToParentRelationships());
};

const testData = [
  [
    'should find the parent for a simple level',
    {
      input: withFbtImportStatement(
        `<fbt desc="d">
            <link href="#">Your friends</link>
            liked your video
          </fbt>;`,
      ),
      output: new Map([[1, 0]]),
    },
  ],
  [
    'should find the parents for a nested level',
    {
      input: withFbtImportStatement(
        `<fbt desc="d">
            <Link href="#">
              Your friends
              <b>liked</b>
            </Link>
            your video
          </fbt>;`,
      ),
      output: new Map([
        [1, 0],
        [2, 1],
      ]),
    },
  ],
  [
    'should find the parents for a multi-nested level',
    {
      input: withFbtImportStatement(
        `<fbt desc="phrase 0">
            <div>
              phrase 1<div>phrase 2</div>
            </div>
            <div>
              phrase 3<div>phrase 4</div>
            </div>
          </fbt>;`,
      ),
      output: new Map([
        [1, 0],
        [2, 1],
        [3, 0],
        [4, 3],
      ]),
    },
  ],
  [
    'should not count an explicit fbt:param as a child',
    {
      input: withFbtImportStatement(
        `<fbt desc="phrase 0">
            <fbt:param name="should not be a child">
              <div href="#">
                <fbt desc="phrase 1">should not be a child</fbt>
              </div>
            </fbt:param>
            <fbt:param name="also should not be a child">
              <div href="#">
                <fbt desc="phrase 2">
                  also should not be a child
                  <div href="#">a child!</div>
                </fbt>
              </div>
            </fbt:param>
            <div href="#">another child!</div>
          </fbt>;`,
      ),
      output: new Map([
        [1, 0],
        [4, 3],
      ]),
    },
  ],
  [
    'should work with children with multiple fbt calls in one file',
    {
      input: withFbtImportStatement(
        `<div>
            <fbt desc="phrase 0">
              <div href="#">phrase 1</div>
            </fbt>
            <fbt desc="phrase 2">
              <div href="#">phrase 3</div>
            </fbt>
          </div>;`,
      ),
      output: new Map([
        [1, 0],
        [3, 2],
      ]),
    },
  ],
] as const;

describe('Test inner-outer strings in JS', () => {
  it('should collect correct parent child relationships', () => {
    for (const item of testData) {
      testChildToParentRelationships(item);
    }
  });
});
