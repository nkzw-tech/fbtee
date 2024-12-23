import { describe, expect, it, test } from '@jest/globals';
import {
  jsCodeFbtCallSerializer,
  snapshotTransformKeepJsx,
  testSectionAsync,
  withFbtImportStatement,
} from './FbtTestUtil.tsx';

expect.addSnapshotSerializer(jsCodeFbtCallSerializer);

const testData = {
  'Enable explicit whitespace': {
    input: withFbtImportStatement(
      `var x = <fbt desc="squelched">
        <fbt:param name="one">{one}</fbt:param>
        {" "}
        <fbt:param name="two">{two}</fbt:param>
        {\` \`}
        <fbt:param name="three">{three}</fbt:param>
      </fbt>;`,
    ),
  },

  'Squelch whitespace when in an expression': {
    input: withFbtImportStatement(
      `var x =
        <fbt desc="squelched">
          {"Squelched white space... "}
          with some
          {' other stuff.'}
        </fbt>;
        baz();`,
    ),
  },

  'fbt:param with multiple children should error': {
    input: withFbtImportStatement(
      `<fbt desc="some-desc">
        <fbt:param name="foo">
          {foo}
          {bar}
        </fbt:param>
      </fbt>`,
    ),

    throws: `fbt:param expects an {expression} or JSX element, and only one`,
  },

  'fbt:param with multiple empty expression containers should be ok': {
    input: withFbtImportStatement(
      `<fbt desc="some-desc">
        <fbt:param name="foo">
          {}
          {/* comment */}
          {foo}
          {}
        </fbt:param>
      </fbt>`,
    ),
  },

  'should be able to house arbitrary markup within fbt:param nodes': {
    input: withFbtImportStatement(
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
  },

  'should be able to nest within React nodes': {
    input: withFbtImportStatement(
      `var x = <div>
        <fbt desc="nested!">
          A nested string
        </fbt>
      </div>;`,
    ),
  },

  'should convert simple strings': {
    input: withFbtImportStatement(
      `var x = <fbt desc="It's simple">A simple string</fbt>;`,
    ),
  },

  'should correctly destruct expression values in options': {
    input: withFbtImportStatement(
      `<fbt desc="d">str
        <fbt:param name="count" number={someNum}>
          {getNum()}
        </fbt:param>
      </fbt>`,
    ),
  },

  'should filter comment and empty expressions from children': {
    input: withFbtImportStatement(
      `var x = <fbt desc="It's simple">
        {
        }A sim{/*
          ignore
          me
          */}ple s{ }tri{}ng{/*ignore me*/}</fbt>;`,
    ),
  },

  'should handle common string': {
    input: withFbtImportStatement(`<fbt common={true}>Done</fbt>`),

    options: {
      fbtCommon: { Done: 'The description for the common string "Done"' },
    },
  },

  'should handle concatenated descriptions': {
    input: withFbtImportStatement(
      `<fbt desc={"A very long description " + "that we will concatenate " +
        "a few times"}
        project={"With" + "a" + "project"}>
        Here it is
      </fbt>;`,
    ),
  },

  'should handle empty string': {
    input: withFbtImportStatement(
      `var x = <fbt desc="a message!">
        A parameterized message to:
        <fbt:param name="emptyString"> </fbt:param>
      </fbt>;`,
    ),
  },

  'should handle enums (with array values)': {
    input: withFbtImportStatement(
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
  },

  'should handle enums (with object values)': {
    input: withFbtImportStatement(
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
  },

  'should handle enums with more text': {
    input: withFbtImportStatement(
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
  },

  'should handle fbt common attribute without value': {
    input: withFbtImportStatement(`<fbt common>Okay</fbt>`),

    options: {
      fbtCommon: { Okay: 'The description for the common string "Okay"' },
    },
  },

  'should handle number={true} - (same output as above test)': {
    input: withFbtImportStatement(
      `var x = <fbt desc="variations!">
        Click to see
        <fbt:param name="count" number={true}>{c}</fbt:param>
        links
      </fbt>;`,
    ),
  },

  'should handle object pronoun': {
    input: withFbtImportStatement(
      `<fbt desc={"d"} project={"p"}>
          I know <fbt:pronoun type="object" gender={gender}/>.
        </fbt>;`,
    ),
  },

  'should handle params': {
    input: withFbtImportStatement(
      `var x = <fbt desc="a message!">
          A parameterized message to:
          <fbt:param name="personName">{theName}</fbt:param>
        </fbt>;`,
    ),
  },

  'should handle single expression with concentated strings': {
    input: withFbtImportStatement(
      `<fbt desc="foo">
        {"foo" + "bar"}
      </fbt>`,
    ),
  },

  'should handle subject+reflexive pronouns': {
    input:
      // She wished herself a happy birthday.
      withFbtImportStatement(
        `<fbt desc={"d"} project={"p"}>
          <fbt:pronoun type="subject" gender={gender} capitalize={true} human={true}/>
          wished <fbt:pronoun type="reflexive" gender={gender} human={true}/> a happy birthday.
        </fbt>;`,
      ),
  },

  'should handle template descriptions': {
    input: withFbtImportStatement(
      `<fbt desc={\`A very long description
        that will be a
        template across multiple lines\`}
        project={"With" + "a" + "project"}>
        Here it is
      </fbt>;`,
    ),
  },

  'should handle variations': {
    input: withFbtImportStatement(
      `var x = <fbt desc="variations!">
        Click to see
        <fbt:param name="count" number="true">{c}</fbt:param>
        links
      </fbt>;`,
    ),
  },

  'should ignore __private attributes': {
    input: withFbtImportStatement(
      `<fbt __self="fbt" desc="some-desc">
        <fbt:param __self="param" name="foo">
          {foo}
        </fbt:param>
      </fbt>`,
    ),
  },

  'should ignore non-expression children in fbt:param': {
    input: withFbtImportStatement(
      `<fbt desc="some-desc">
        <fbt:param name="foo">
          !{foo}!
        </fbt:param>
      </fbt>`,
    ),
  },

  'should insert param value for same-param': {
    input: withFbtImportStatement(
      `<fbt desc="d">str
        <fbt:param name="foo">{Bar}</fbt:param> and
        <fbt:same-param name="foo"/>
      </fbt>`,
    ),
  },

  'should maintain order of params and enums': {
    input: withFbtImportStatement(
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
  },

  'should not insert extra space': {
    input: withFbtImportStatement(
      `<fbt desc="Greating in i18n demo">
        Hello, <fbt:param name="guest">
          {guest}
        </fbt:param>!
      </fbt>`,
    ),
  },

  'should strip out more newlines': {
    input: withFbtImportStatement(
      `var x =
        <fbt desc="moar lines">
          A simple string...
          with some other stuff.
        </fbt>;
        baz();`,
    ),
  },

  'should strip out newlines': {
    input: withFbtImportStatement(
      `var x =
        <fbt desc="Test trailing space when not last child">
          Preamble
          <fbt:param name="parm">{blah}</fbt:param>
        </fbt>;
      baz();`,
    ),
  },

  'should support html escapes': {
    input: withFbtImportStatement(
      `<fbt desc="foo &quot;bar&quot;">&times;</fbt>`,
    ),
  },

  'should support non-breasking space character': {
    // multiple spaces are normalized to a single space
    // but &nbsp characters are preserved
    input: withFbtImportStatement(
      `<fbt desc="desc with    non-breaking&nbsp;&nbsp;&nbsp;space">
          text with    non-breaking&nbsp;&nbsp;&nbsp;space
      </fbt>`,
    ),
  },

  'should support unicode characters': {
    input: withFbtImportStatement(
      `// A backslash \\ in comments
      <fbt desc="unicode characters">
        A copyright sign {'\\u00A9'},
        a multi byte character {'\\uD83D\\uDCA9'},
        and a backslash {'\\\\'}.
      </fbt>`,
    ),
  },

  'should throw for fbt that has description and common attribute (without value)':
    {
      input: withFbtImportStatement(`<fbt common={true} desc='d'>No</fbt>`),

      options: {
        fbtCommon: { No: 'The description for the common string "No"' },
      },

      throws: `<fbt common> must not have "desc" attribute.`,
    },

  'should throw for strings with `common` attribute equal to false': {
    input: withFbtImportStatement(`<fbt common={false}>Yes</fbt>`),

    options: {
      fbtCommon: { Yes: 'The description for the common string "Yes"' },
    },

    throws: `This node requires a 'desc' attribute.`,
  },

  'should throw on invalid attributes in fbt:param': {
    input: withFbtImportStatement(
      `<fbt desc="some-desc">
        <fbt:param name="foo" qux="foo" desc="foo-desc">
          {foo}
        </fbt:param>
      </fbt>`,
    ),

    throws: `Invalid option "qux". Only allowed: gender, number, name`,
  },

  'should throw on undefined common string': {
    input: withFbtImportStatement(
      `<fbt common={true}>Some undefined common string</fbt>`,
    ),

    options: {},

    throws: `Unknown string "Some undefined common string" for <fbt common={true}>`,
  },

  'should treat multiline descs as a single line': {
    input: withFbtImportStatement(
      `<fbt desc="hi how are you today im doing well i guess
        how is your mother is she well yeah why not lets go
        home and never come back.">
        lol
      </fbt>`,
    ),
  },

  'should work with fragments': {
    input: withFbtImportStatement(
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
  },

  'should work with implicit fragments': {
    input: withFbtImportStatement(
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
  },
};

describe('Test declarative (jsx) fbt syntax translation', () =>
  testSectionAsync(testData, snapshotTransformKeepJsx, {
    matchSnapshot: true,
  }));

describe('Test fbt transforms without the jsx transform', () => {
  it('not nested', async () => {
    expect(
      await snapshotTransformKeepJsx(
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
      await snapshotTransformKeepJsx(
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
      await snapshotTransformKeepJsx(
        withFbtImportStatement(`
        let x = <fbt desc="" doNotExtract>Test</fbt>;
      `),
      ),
    ).toMatchSnapshot();
  });

  it('short bool syntax for number attribute', async () => {
    expect(
      await snapshotTransformKeepJsx(
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
        await snapshotTransformKeepJsx(
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
        await snapshotTransformKeepJsx(
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
        await snapshotTransformKeepJsx(
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
        await snapshotTransformKeepJsx(
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
      await snapshotTransformKeepJsx(
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
      await snapshotTransformKeepJsx(
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
    await snapshotTransformKeepJsx(
      withFbtImportStatement(`
        let x = <fbt common>Submit</fbt>;
      `),
      options,
    ),
  ).toEqual(
    await snapshotTransformKeepJsx(
      withFbtImportStatement(`
        let x = <fbt common={true}>Submit</fbt>;
      `),
      options,
    ),
  );
});
