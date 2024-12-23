import { describe, expect, it } from '@jest/globals';
import TestFbtEnumManifest from '../__mocks__/TestFbtEnumManifest.tsx';
import {
  jsCodeFbtCallSerializer,
  snapshotTransform,
  withFbtImportStatement,
} from './FbtTestUtil.tsx';

expect.addSnapshotSerializer(jsCodeFbtCallSerializer);

const transform = (input: string) =>
  snapshotTransform(withFbtImportStatement(input), {
    fbtEnumManifest: TestFbtEnumManifest,
  });

describe('Test Fbt Enum', () => {
  it('should handle jsx enums (with references)', () => {
    expect(
      transform(
        `import aEnum from 'Test$FbtEnum';
        var x = (
          <fbt desc="enums!">
            Click to see
            <fbt:enum enum-range={aEnum} value={id} />
          </fbt>
        );`,
      ),
    ).toMatchSnapshot();
  });

  it('should handle jsx string literals', () => {
    expect(
      transform(
        `import aEnum from 'Test$FbtEnum';
        var x = (
          <fbt desc="enums!">
            Click to see
            <fbt:enum enum-range={aEnum} value="id1" />
          </fbt>
        );`,
      ),
    ).toMatchSnapshot();
  });

  it('should handle functional enums (with references) (require)', () => {
    expect(
      transform(
        `import aEnum from 'Test$FbtEnum';
        var x = fbt('Click to see ' + fbt.enum(id, aEnum), 'enums!');`,
      ),
    ).toMatchSnapshot();
  });

  it('should handle functional enums (with references) (import default)', () => {
    expect(
      transform(`
        import aEnum from 'Test$FbtEnum';
        var x = fbt('Click to see ' + fbt.enum(id, aEnum), 'enums!');
      `),
    ).toMatchSnapshot();
  });

  it('should handle functional enums (with references) (import star)', () => {
    expect(
      transform(`
        import * as aEnum from 'Test$FbtEnum';
        var x = fbt('Click to see ' + fbt.enum(id, aEnum), 'enums!');
      `),
    ).toMatchSnapshot();
  });

  it('should handle functional enums (with references) in templates', () => {
    expect(
      transform(
        `import aEnum from 'Test$FbtEnum';
          var x = fbt(\`Click to see \${fbt.enum(id, aEnum)}\`, 'enums!');`,
      ),
    ).toMatchSnapshot();
  });

  it('should throw when enum values are not strings', () => {
    expect(() =>
      snapshotTransform(
        withFbtImportStatement(
          `import aEnum from 'Test$FbtEnum';
          var x = fbt('This is ' + fbt.enum(id, {bad: \`egg\`}), 'enums!');`,
        ),
        { fbtEnumManifest: TestFbtEnumManifest },
      ),
    ).toThrow('Enum values must be string literals');
  });

  describe('when used with dynamic enum keys', () => {
    it('should throw the enum key is a variable (Identifier)', () => {
      expect(() =>
        snapshotTransform(
          withFbtImportStatement(
            `const foo = 'anything';
            <fbt desc="try fbt:enum with a dynamic enum key">
              <fbt:enum
                enum-range={{
                  [foo]: 'bar',
                }}
                value={myValue}
              />
            </fbt>;`,
          ),
          { fbtEnumManifest: TestFbtEnumManifest },
        ),
      ).toThrow('Enum keys must be string literals instead of `');
    });

    it('should throw the enum key is a variable (MemberExpression)', () => {
      expect(() =>
        snapshotTransform(
          withFbtImportStatement(
            `const foo = {bar: 'anything'};
            <fbt desc="try fbt:enum with a dynamic enum key">
              <fbt:enum
                enum-range={{
                  [foo.bar]: 'baz',
                }}
                value={myValue}
              />
            </fbt>;`,
          ),
          { fbtEnumManifest: TestFbtEnumManifest },
        ),
      ).toThrow('Enum keys must be string literals instead of `');
    });
  });

  it('should throw on multiple import types', () => {
    expect(() =>
      snapshotTransform(
        withFbtImportStatement(
          `import aEnum, * as bEnum from 'Test$FbtEnum';
          var x = fbt('Click to see ' + fbt.enum(id, aEnum), 'enums!');`,
        ),
      ),
    ).toThrow('Fbt Enum `aEnum` not registered');
  });

  it('should throw on destructured imports', () => {
    expect(() =>
      snapshotTransform(
        withFbtImportStatement(
          `import {aEnum} from 'Test$FbtEnum';
          var x = fbt('Click to see ' + fbt.enum(id, aEnum), 'enums!');`,
        ),
      ),
    ).toThrow('Fbt Enum `aEnum` not registered');
  });
});
