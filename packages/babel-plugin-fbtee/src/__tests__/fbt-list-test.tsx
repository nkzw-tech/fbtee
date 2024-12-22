import { expect, test } from '@jest/globals';
import {
  jsCodeFbtCallSerializer,
  snapshotTransform,
  withFbtImportStatement,
} from './FbtTestUtil.tsx';

expect.addSnapshotSerializer(jsCodeFbtCallSerializer);

const transform = (input: string) =>
  snapshotTransform(withFbtImportStatement(input));

test('fbt.list()', () => {
  expect(
    transform(
      `fbt(
        'Available Locations: ' + fbt.list('locations', ['Tokyo', 'London', 'Vienna'], null, 'or'),
        'Lists',
      )`,
    ),
  ).toMatchSnapshot();
});

test('<fbt:list>', () => {
  expect(
    transform(
      `const x = (
          <fbt desc="Lists">
            Available Locations: <fbt:list name="locations" items={["Tokyo", "London", "Vienna"]} />.
          </fbt>
        );`,
    ),
  ).toMatchSnapshot();

  expect(
    transform(
      `const x = (
          <fbt desc="Lists">
            Available Locations: <fbt:list name="locations" conjunction="and" items={["Tokyo", "London", "Vienna"]} />.
          </fbt>
        );`,
    ),
  ).toMatchSnapshot();

  expect(
    transform(
      `const x = (
          <fbt desc="Lists">
            Available Locations: <fbt:list name="locations" delimiter="bullet" items={["Tokyo", "London", "Vienna"]} />.
          </fbt>
        );`,
    ),
  ).toMatchSnapshot();

  expect(
    transform(
      `const x = (
          <fbt desc="Lists">
            Available Locations: <fbt:list name="locations" conjunction="or" delimiter="bullet" items={["Tokyo", "London", "Vienna"]} />.
          </fbt>
        );`,
    ),
  ).toMatchSnapshot();
});
