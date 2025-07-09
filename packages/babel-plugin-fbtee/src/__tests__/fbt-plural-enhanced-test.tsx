import { describe, expect, it } from '@jest/globals';
import {
  jsCodeFbtCallSerializer,
  snapshotTransform,
  withFbtImportStatement,
} from './FbtTestUtil.tsx';

expect.addSnapshotSerializer(jsCodeFbtCallSerializer);

describe('Enhanced fbt:plural API with CLDR categories', () => {
  it('should support Russian plurals with few prop', () => {
    expect(
      snapshotTransform(
        withFbtImportStatement(`
          <fbt desc="Russian apple count">
            У вас
            <fbt:plural
              count={appleCount}
              few="яблока"
              many="яблок"
              name="appleCount"
              showCount="yes"
            >
              яблоко
            </fbt:plural>
          </fbt>
        `),
      ),
    ).toMatchSnapshot();
  });

  it('should support Arabic plurals with zero, two, and few props', () => {
    expect(
      snapshotTransform(
        withFbtImportStatement(`
          <fbt desc="Arabic photo count">
            <fbt:plural
              count={photoCount}
              zero="لا توجد صور"
              two="صورتان"
              few="صور"
              many="صورة"
              name="photoCount"
              showCount="yes"
            >
              صورة واحدة
            </fbt:plural>
          </fbt>
        `),
      ),
    ).toMatchSnapshot();
  });

  it('should support Hebrew plurals with two prop', () => {
    expect(
      snapshotTransform(
        withFbtImportStatement(`
          <fbt desc="Hebrew book count">
            <fbt:plural
              count={bookCount}
              two="שני ספרים"
              many="ספרים"
              name="bookCount"
              showCount="yes"
            >
              ספר אחד
            </fbt:plural>
          </fbt>
        `),
      ),
    ).toMatchSnapshot();
  });

  it('should maintain backward compatibility with just many prop', () => {
    expect(
      snapshotTransform(
        withFbtImportStatement(`
          <fbt desc="Simple English plural">
            <fbt:plural
              count={itemCount}
              many="items"
              name="itemCount"
              showCount="yes"
            >
              item
            </fbt:plural>
          </fbt>
        `),
      ),
    ).toMatchSnapshot();
  });

  it('should fallback to many when CLDR categories are not provided', () => {
    expect(
      snapshotTransform(
        withFbtImportStatement(`
          <fbt desc="Partial CLDR support">
            <fbt:plural
              count={count}
              few="некоторые элементы"
              many="много элементов"
              name="count"
              showCount="yes"
            >
              один элемент
            </fbt:plural>
          </fbt>
        `),
      ),
    ).toMatchSnapshot();
  });
});
