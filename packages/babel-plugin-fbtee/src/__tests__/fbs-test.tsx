import { describe, expect, it } from '@jest/globals';
import TestFbtEnumManifest from '../__mocks__/TestFbtEnumManifest.tsx';
import {
  jsCodeFbtCallSerializer,
  snapshotTransform,
  withFbsImportStatement,
} from './FbtTestUtil.tsx';

expect.addSnapshotSerializer(jsCodeFbtCallSerializer);

describe('Test declarative (jsx) <fbs> syntax translation', () => {
  it('should convert a simple string', () => {
    expect(
      snapshotTransform(
        withFbsImportStatement(
          `const fbsElem = <fbs desc='str_description'>a simple string</fbs>;`,
        ),
      ),
    ).toMatchSnapshot();
  });
  it('should convert a string with a parameter', () => {
    expect(
      snapshotTransform(
        withFbsImportStatement(`
          const fbsElem = <fbs desc='str_description'>
            a string with a
            <fbs:param name="param name">{parameter}</fbs:param>
          </fbs>;
        `),
      ),
    ).toMatchSnapshot();
  });
  it('should convert a common string', () => {
    expect(
      snapshotTransform(
        withFbsImportStatement(`
          const fbsCommonElem = <fbs common={true}>Post</fbs>;
        `),
        {
          fbtCommon: {
            Post: 'Button to post a comment',
          },
        },
      ),
    ).toMatchSnapshot();
  });
  it('should reject an <fbs> child element', () => {
    expect(() =>
      snapshotTransform(
        withFbsImportStatement(`
          const fbsElem = <fbs desc='str_description'>
            a simple string
            <fbs>nested</fbs>
          </fbs>;
        `),
      ),
    ).toThrow(`Don't put <fbs> directly within <fbs>.`);
  });
  it('should reject an <fbt> child element', () => {
    expect(() =>
      snapshotTransform(
        withFbsImportStatement(`
          const fbsElem = <fbs desc='str_description'>
            a simple string
            <fbt>nested</fbt>
          </fbs>;
        `),
      ),
    ).toThrow(`Don't put <fbt> directly within <fbs>.`);
  });
  it('should reject an <fbt:param> child element', () => {
    expect(() =>
      snapshotTransform(
        withFbsImportStatement(`
          const fbsElem = <fbs desc='str_description'>
            a simple string
            <fbt:param name="param name">{parameter}</fbt:param>
          </fbs>;
        `),
      ),
    ).toThrow(`Don't mix <fbt> and <fbs> JSX namespaces.`);
  });
  it('should handle <fbs:enum>', () => {
    expect(
      snapshotTransform(
        withFbsImportStatement(`
          import aEnum from 'Test$FbtEnum';
          var x = (
            <fbs desc="enums!">
              Click to see
              <fbs:enum enum-range={aEnum} value={id} />
            </fbs>
          );
        `),
        { fbtEnumManifest: TestFbtEnumManifest },
      ),
    ).toMatchSnapshot();
  });
});

describe('Test functional fbs() syntax translation', () => {
  it('should convert a simple string', () => {
    expect(
      snapshotTransform(
        withFbsImportStatement(
          `const fbsCall = fbs('a simple string', 'str_description');`,
        ),
      ),
    ).toMatchSnapshot();
  });
  it('should convert a string with a gender parameter', () => {
    expect(
      snapshotTransform(
        withFbsImportStatement(`
          import IntlVariations from 'IntlVariations';
          const fbsCall = fbs(
            'a string with a ' + fbs.param('param name', parameter, {gender: IntlVariations.GENDER_MALE}),
            'str_description'
          );
        `),
      ),
    ).toMatchSnapshot();
  });
  it('should convert a common string', () => {
    expect(
      snapshotTransform(
        withFbsImportStatement(`const fbsCommonCall = fbs.c('Post');`),
      ),
    ).toMatchSnapshot();
  });

  it('should reject an fbt parameter', () => {
    expect(() =>
      snapshotTransform(
        withFbsImportStatement(`
          const fbsCall = fbs(
            'a string with a ' + fbt.param('param name', parameter, {gender: 'male'}),
            'str_description'
          );
        `),
      ),
    ).toThrow(`fbs: unsupported node: CallExpression`);
  });

  it('should throw when using fbs() and the fbs variable is not bound', () => {
    expect(() =>
      snapshotTransform(
        `const fbsCall = fbs(
          'basic',
          'str_description'
        );`,
      ),
    ).toThrow(`fbs is not bound. Did you forget to import fbs?`);
  });

  it('should throw when using <fbs> and the fbs variable is not bound', () => {
    expect(() =>
      snapshotTransform(
        `const fbsCall = <fbs desc="str_description">basic</fbs>;`,
      ),
    ).toThrow(`fbs is not bound. Did you forget to import fbs?`);
  });

  it('should handle fbs.enum', () => {
    expect(
      snapshotTransform(
        withFbsImportStatement(`
          import aEnum from 'Test$FbtEnum';
          var x = fbs('Click to see ' + fbs.enum(id, aEnum), 'enums!');
        `),
        { fbtEnumManifest: TestFbtEnumManifest },
      ),
    ).toMatchSnapshot();
  });
});
