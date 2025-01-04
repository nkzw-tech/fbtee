import { describe, expect, it, test } from '@jest/globals';
import {
  jsCodeFbtCallSerializer,
  snapshotTransformKeepJsx,
  withFbtImportStatement,
} from './FbtTestUtil.tsx';

expect.addSnapshotSerializer(jsCodeFbtCallSerializer);

describe('Test declarative (jsx) fbt syntax translation', () => {
  test('Enable explicit whitespace', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `var x = <fbt desc="squelched">
            <fbt:param name="one">{one}</fbt:param>
            {" "}
            <fbt:param name="two">{two}</fbt:param>
            {\` \`}
            <fbt:param name="three">{three}</fbt:param>
          </fbt>;`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('Squelch whitespace when in an expression', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `var x =
            <fbt desc="squelched">
              {"Squelched white space... "}
              with some
              {' other stuff.'}
            </fbt>;
            baz();`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('fbt:param with multiple children should error', () => {
    expect(() =>
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<fbt desc="some-desc">
            <fbt:param name="foo">
              {foo}
              {bar}
            </fbt:param>
          </fbt>`,
        ),
      ),
    ).toThrow(`fbt:param expects an {expression} or JSX element, and only one`);
  });

  test('fbt:param with multiple empty expression containers should be ok', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<fbt desc="some-desc">
            <fbt:param name="foo">
              {}
              {/* comment */}
              {foo}
              {}
            </fbt:param>
          </fbt>`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should be able to house arbitrary markup within fbt:param nodes', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<div>
            <fbt desc="...">
              <fbt:param name="time">{formatDate(date, "F d, Y")}</fbt:param>
                by
              <fbt:param name="user name">
                <Link href={{url:user.link}}>
                  {user.name}
                </Link>
              </fbt:param>
            </fbt>
          </div>;`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should be able to nest within React nodes', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `var x = <div>
              <fbt desc="nested!">
                A nested string
              </fbt>
            </div>;`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should convert simple strings', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `var x = <fbt desc="It's simple">A simple string</fbt>;`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should correctly destruct expression values in options', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<fbt desc="d">str
            <fbt:param name="count" number={someNum}>
              {getNum()}
            </fbt:param>
          </fbt>`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should filter comment and empty expressions from children', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `var x = <fbt desc="It's simple">
            {
            }A sim{/*
              ignore
              me
              */}ple s{ }tri{}ng{/*ignore me*/}</fbt>;`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should handle common string', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(`<fbt common={true}>Done</fbt>`),
        { fbtCommon: { Done: 'The description for the common string "Done"' } },
      ),
    ).toMatchSnapshot();
  });

  test('should handle concatenated descriptions', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<fbt desc={"A very long description " + "that we will concatenate " +
            "a few times"}
            project={"With" + "a" + "project"}>
            Here it is
          </fbt>;`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should handle empty string', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `var x = <fbt desc="a message!">
            A parameterized message to:
            <fbt:param name="emptyString"> </fbt:param>
          </fbt>;`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should handle enums (with array values)', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `var x = <fbt desc="enums!">
            Click to see
            <fbt:enum
              enum-range={[
                "groups",
                "photos",
                "videos"
              ]}
              value={id}
            />
          </fbt>;`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should handle enums (with object values)', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `var x = <fbt desc="enums!">
              Click to see
              <fbt:enum
                enum-range={{
                  id1: "groups",
                  id2: "photos",
                  id3: "videos"
                }}
                value={id}
              />
            </fbt>;`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should handle enums with more text', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `var x = <fbt desc="enums!">
            Click to see
            <fbt:enum
              enum-range={{
                id1: "groups",
                id2: "photos",
                id3: "videos"
              }}
              value={id}
            />
            Hey-hey!
          </fbt>;`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should handle fbt common attribute without value', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(`<fbt common>Okay</fbt>`),
        { fbtCommon: { Okay: 'The description for the common string "Okay"' } },
      ),
    ).toMatchSnapshot();
  });

  test('should handle number={true} - (same output as above test)', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `var x = <fbt desc="variations!">
            Click to see
            <fbt:param name="count" number={true}>{c}</fbt:param>
            links
          </fbt>;`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should handle object pronoun', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<fbt desc={"d"} project={"p"}>
            I know <fbt:pronoun type="object" gender={gender}/>.
          </fbt>;`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should handle params', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `var x = <fbt desc="a message!">
              A parameterized message to:
              <fbt:param name="personName">{theName}</fbt:param>
            </fbt>;`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should handle single expression with concatenated strings', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<fbt desc="foo">
            {"foo" + "bar"}
          </fbt>`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should handle subject+reflexive pronouns', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<fbt desc={"d"} project={"p"}>
            <fbt:pronoun type="subject" gender={gender} capitalize={true} human={true}/>
            wished <fbt:pronoun type="reflexive" gender={gender} human={true}/> a happy birthday.
          </fbt>;`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should handle template descriptions', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<fbt desc={\`A very long description
            that will be a
            template across multiple lines\`}
            project={"With" + "a" + "project"}>
            Here it is
          </fbt>;`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should handle variations', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `var x = <fbt desc="variations!">
            Click to see
            <fbt:param name="count" number="true">{c}</fbt:param>
            links
          </fbt>;`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should ignore __private attributes', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<fbt __self="fbt" desc="some-desc">
            <fbt:param __self="param" name="foo">
              {foo}
            </fbt:param>
          </fbt>`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should ignore non-expression children in fbt:param', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<fbt desc="some-desc">
            <fbt:param name="foo">
              !{foo}!
            </fbt:param>
          </fbt>`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should insert param value for same-param', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<fbt desc="d">str
            <fbt:param name="foo">{Bar}</fbt:param> and
            <fbt:same-param name="foo"/>
          </fbt>`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should maintain order of params and enums', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<fbt desc="some-desc">
            Hello,
            <fbt:param name="foo">
              {foo}
            </fbt:param>
            <fbt:enum enum-range={["x", "y"]} value={x} />
            <fbt:param name="bar" number={n}>
              {bar}
            </fbt:param>
          </fbt>`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should not insert extra space', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<fbt desc="Greating in i18n demo">
            Hello, <fbt:param name="guest">
              {guest}
            </fbt:param>!
          </fbt>`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should strip out more newlines', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `var x =
            <fbt desc="moar lines">
              A simple string...
              with some other stuff.
            </fbt>;
            baz();`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should strip out newlines', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `var x =
            <fbt desc="Test trailing space when not last child">
              Preamble
              <fbt:param name="parm">{blah}</fbt:param>
            </fbt>;
          baz();`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should support html escapes', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(`<fbt desc="foo &quot;bar&quot;">&times;</fbt>`),
      ),
    ).toMatchSnapshot();
  });

  test('should support non-breaking space character', () => {
    // multiple spaces are normalized to a single space
    // but &nbsp characters are preserved
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<fbt desc="desc with    non-breaking&nbsp;&nbsp;&nbsp;space">
              text with    non-breaking&nbsp;&nbsp;&nbsp;space
          </fbt>`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should support unicode characters', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `// A backslash \\ in comments
          <fbt desc="unicode characters">
            A copyright sign {'\\u00A9'},
            a multi byte character {'\\uD83D\\uDCA9'},
            and a backslash {'\\\\'}.
          </fbt>`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should throw for fbt that has description and common attribute (without value)', () => {
    expect(() =>
      snapshotTransformKeepJsx(
        withFbtImportStatement(`<fbt common={true} desc='d'>No</fbt>`),
        { fbtCommon: { No: 'The description for the common string "No"' } },
      ),
    ).toThrow(`<fbt common> must not have "desc" attribute.`);
  });

  test('should throw for strings with `common` attribute equal to false', () => {
    expect(() =>
      snapshotTransformKeepJsx(
        withFbtImportStatement(`<fbt common={false}>Yes</fbt>`),
        { fbtCommon: { Yes: 'The description for the common string "Yes"' } },
      ),
    ).toThrow(`This node requires a 'desc' attribute.`);
  });

  test('should throw on invalid attributes in fbt:param', () => {
    expect(() =>
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<fbt desc="some-desc">
            <fbt:param name="foo" qux="foo" desc="foo-desc">
              {foo}
            </fbt:param>
          </fbt>`,
        ),
      ),
    ).toThrow(`Invalid option "qux". Only allowed: gender, number, name`);
  });

  test('should throw on undefined common string', () => {
    expect(() =>
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<fbt common={true}>Some undefined common string</fbt>`,
        ),
        {},
      ),
    ).toThrow(
      `Unknown string "Some undefined common string" for <fbt common={true}>`,
    );
  });

  test('should treat multiline descs as a single line', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<fbt desc="hi how are you today im doing well i guess
            how is your mother is she well yeah why not lets go
            home and never come back.">
            lol
          </fbt>`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should work with fragments', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<Fragment>
            <fbt desc="...">
              <fbt:param name="time">{formatDate(date, "F d, Y")}</fbt:param>
               by
              <fbt:param name="user name">
                <Link href={{url:user.link}}>
                  {user.name}
                </Link>
              </fbt:param>
            </fbt>
          </Fragment>;`,
        ),
      ),
    ).toMatchSnapshot();
  });

  test('should work with implicit fragments', () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(
          `<>
            <fbt desc="...">
              <fbt:param name="time">{formatDate(date, "F d, Y")}</fbt:param>
               by
              <fbt:param name="user name">
                <Link href={{url:user.link}}>
                  {user.name}
                </Link>
              </fbt:param>
            </fbt>
          </>;`,
        ),
      ),
    ).toMatchSnapshot();
  });
});

describe('Test fbt transforms without the jsx transform', () => {
  it('not nested', async () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(`
        let x =
          <fbt desc="nested!">
            A nested string
          </fbt>;
      `),
      ),
    ).toMatchSnapshot(); // Should be like fbt._()
  });

  it('nested in div', async () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(`
        let x =
          <div>
            <fbt desc="nested!">
              A nested string
            </fbt>
          </div>;
      `),
      ),
    ).toMatchSnapshot(); // Should be like <div>{fbt._()}</div>
  });

  it('short bool syntax for doNotExtract attribute', async () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(`
        let x = <fbt desc="" doNotExtract>Test</fbt>;
      `),
      ),
    ).toMatchSnapshot();
  });

  it('short bool syntax for number attribute', async () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(`
        let x =
          <fbt desc="">
            <fbt:param name="name" number>{'name'}</fbt:param>
          </fbt>;
      `),
      ),
    ).toMatchSnapshot();
  });

  describe('when using within template literals', () => {
    it('should work with a basic <fbt>', async () => {
      expect(
        snapshotTransformKeepJsx(
          withFbtImportStatement(`
          html\`<div>
            \${
              <fbt desc="some desc" project="some project">
                basic text
              </fbt>
            }
          </div>\`;
        `),
        ),
      ).toMatchSnapshot();
    });

    it('should work with basic <fbt> auto-parameterization', async () => {
      expect(
        snapshotTransformKeepJsx(
          withFbtImportStatement(`
          html\`<div>
            \${
              <fbt desc="some desc" project="some project">
                outer text
                <strong>
                  bold text
                </strong>
              </fbt>
            }
          </div>\`;
        `),
        ),
      ).toMatchSnapshot();
    });

    it('should dedupe plurals', async () => {
      expect(
        snapshotTransformKeepJsx(
          withFbtImportStatement(`
          <fbt desc="desc...">
            There
            <fbt:plural count={num} many="are">is</fbt:plural>{' '}
            <fbt:plural count={num} showCount="yes" value={hi()}>
              photo
            </fbt:plural>.
          </fbt>
        `),
        ),
      ).toMatchSnapshot();
    });

    it('should work with a nested <fbt> within an <fbt:param>', async () => {
      expect(
        snapshotTransformKeepJsx(
          withFbtImportStatement(`
          html\`<div>
            \${
              <fbt desc="some desc" project="some project">
                outer text
                <fbt:param name="param text">
                  {
                    html\`<strong>
                      \${
                        <fbt desc="inner string">
                          inner text
                          <fbt:param name="inner param">
                            {'bold'}
                          </fbt:param>
                        </fbt>
                      }
                    </strong>\`
                  }
                </fbt:param>
              </fbt>
            }
          </div>\`;
        `),
        ),
      ).toMatchSnapshot();
    });
  });

  // TODO: Fix preserving whitespace for JSX text.
  it('should fail to preserve whitespace in text when preserveWhitespace=true (known bug)', async () => {
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(`
        <fbt desc="desc with 3   spaces" preserveWhitespace={true}>
          Some text with 3   spaces in between.
        </fbt>;
      `),
      ),
    ).toMatchSnapshot();
  });

  // TODO: We should NOT insert a space between two <fbt:plural>'s
  it(`[legacy buggy behavior] <fbt:pronoun> should insert a space character between two fbt constructs that don't neighbor raw text`, async () =>
    expect(
      snapshotTransformKeepJsx(
        withFbtImportStatement(`
        <fbt desc="">
          You can add
          <fbt:plural count={count} many="these">
            this
          </fbt:plural>
          <fbt:plural count={count} many="tags">
            tag
          </fbt:plural>
          to anything.
        </fbt>
      `),
      ),
    ).toMatchSnapshot());
});

test('Test common fbt with value-less `common` attribute should have same runtime call as the regular common fbt', async () => {
  const options = {
    fbtCommon: { Submit: 'The description for the common string "Submit"' },
  };
  expect(
    snapshotTransformKeepJsx(
      withFbtImportStatement(`
        let x = <fbt common>Submit</fbt>;
      `),
      options,
    ),
  ).toEqual(
    snapshotTransformKeepJsx(
      withFbtImportStatement(`
        let x = <fbt common={true}>Submit</fbt>;
      `),
      options,
    ),
  );
});
