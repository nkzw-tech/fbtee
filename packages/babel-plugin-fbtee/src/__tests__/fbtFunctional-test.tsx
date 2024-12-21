import { describe, expect, jest, test } from '@jest/globals';
import TestFbtEnumManifest from '../__mocks__/TestFbtEnumManifest.tsx';
import FbtFunctionCallProcessor from '../babel-processors/FbtFunctionCallProcessor.tsx';
import { getExtractedStrings, PluginOptions } from '../index.tsx';
import { FbtVariationType } from '../translate/IntlVariations.tsx';
import {
  payload,
  testSection,
  transform,
  withFbtImportStatement,
} from './FbtTestUtil.tsx';

type TestCase = Readonly<{
  input: string;
  inputWithArraySyntax?: string;
  options?: Record<string, unknown>;
  output?: string;
  runWithTestFbtEnumManifest?: typeof TestFbtEnumManifest;
  throws?: boolean | string;
}>;

type TestCases = Record<string, TestCase>;

const testCases: TestCases = {
  'should accept well-formed options': {
    input: withFbtImportStatement(
      `fbt('A string that moved files', 'options!', {
        author: 'jwatson',
        project: 'Super Secret',
      });`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `fbt(['A string that moved files'], 'options!', {
        author: 'jwatson',
        project: 'Super Secret',
      });`,
    ),

    output: withFbtImportStatement(
      `fbt._(
        ${payload({
          jsfbt: {
            m: [],
            t: {
              desc: 'options!',
              text: 'A string that moved files',
            },
          },
          project: 'Super Secret',
        })},
      );`,
    ),
  },

  'should allow description concatenation': {
    input: withFbtImportStatement(
      `var x = fbt(
        'A short string',
        'With a ridiculously long description that' +
          ' requires concatenation',
      );`,
    ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [],
            t: {
              desc: 'With a ridiculously long description that requires concatenation',
              text: 'A short string',
            },
          },
        })},
      );`,
    ),
  },

  'should avoid creating identifers with conflicted name when there exist inner strings and string variations':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var fbt_sv_arg_2 = 2;
        function a(fbt_sv_arg_3) {
          var fbt_sv_arg_0 = 1;
          <fbt desc="example 1">
            <fbt:param name="name" gender={this.state.ex1Gender}>
              <b className="padRight">{this.state.ex1Name}</b>
            </fbt:param>
            has shared
            <a className="neatoLink" href="#" tabindex={123} id={"uniq"}>
              <strong>
                <fbt:plural
                  many="photos"
                  showCount="ifMany"
                  count={this.state.ex1Count}>
                  a photo
                </fbt:plural>
              </strong>
            </a>
            with you
          </fbt>;
        }`,
      ),

      output: withFbtImportStatement(
        `import React from 'react';
        var fbt_sv_arg_2 = 2;
        function a(fbt_sv_arg_3) {
          var fbt_sv_arg_1, fbt_sv_arg_4;
          var fbt_sv_arg_0 = 1;
          (
            fbt_sv_arg_1 = fbt._param(
              "name",
              /*#__PURE__*/React.createElement(
                "b",
                {className: "padRight"},
                this.state.ex1Name,
              ),
              [1, this.state.ex1Gender],
            ),
            fbt_sv_arg_4 = fbt._plural(this.state.ex1Count, "number"),
            fbt._(
            ${payload({
              jsfbt: {
                m: [
                  {
                    token: 'name',
                    type: 1,
                  },
                  {
                    singular: true,
                    token: 'number',
                    type: 2,
                  },
                ],
                t: {
                  '*': {
                    '*': {
                      desc: 'example 1',
                      text: '{name} has shared {=[number] photos} with you',
                      tokenAliases: { '=[number] photos': '=m2' },
                    },
                    _1: {
                      desc: 'example 1',
                      text: '{name} has shared {=a photo} with you',
                      tokenAliases: { '=a photo': '=m2' },
                    },
                  },
                },
              },
              project: '',
            })},
            [
              fbt_sv_arg_1,
              fbt_sv_arg_4,
              fbt._implicitParam(
                "=m2",
                /*#__PURE__*/React.createElement(
                  "a",
                  {
                    className: "neatoLink",
                    href: "#",
                    tabindex: 123,
                    id: "uniq",
                  },
                  fbt._(
                    ${payload({
                      jsfbt: {
                        m: [
                          {
                            token: 'name',
                            type: 1,
                          },
                          {
                            singular: true,
                            token: 'number',
                            type: 2,
                          },
                        ],
                        t: {
                          '*': {
                            '*': {
                              desc: 'In the phrase: "{name} has shared {=[number] photos} with you"',
                              text: '{=[number] photos}',
                              tokenAliases: { '=[number] photos': '=m1' },
                            },
                            _1: {
                              desc: 'In the phrase: "{name} has shared {=a photo} with you"',
                              text: '{=a photo}',
                              tokenAliases: { '=a photo': '=m1' },
                            },
                          },
                        },
                      },
                      project: '',
                    })},
                    [
                      fbt_sv_arg_1,
                      fbt_sv_arg_4,
                      fbt._implicitParam(
                        "=m1",
                        /*#__PURE__*/React.createElement(
                          "strong",
                          null,
                          fbt._(
                            ${payload({
                              jsfbt: {
                                m: [
                                  {
                                    token: 'name',
                                    type: 1,
                                  },
                                  {
                                    singular: true,
                                    token: 'number',
                                    type: 2,
                                  },
                                ],
                                t: {
                                  '*': {
                                    '*': {
                                      desc: 'In the phrase: "{name} has shared {=[number] photos} with you"',
                                      text: '{number} photos',
                                    },
                                    _1: {
                                      desc: 'In the phrase: "{name} has shared {=a photo} with you"',
                                      text: 'a photo',
                                    },
                                  },
                                },
                              },
                              project: '',
                            })},
                            [
                              fbt_sv_arg_1,
                              fbt_sv_arg_4,
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              )
            ]
          ));
        }`,
      ),
    },

  'should be able to nest within React nodes': {
    input: withFbtImportStatement(
      `import React from 'react';
      var x = <div>{fbt('A nested string', 'nested!')}</div>;`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `import React from 'react';
      var x = <div>{fbt(['A nested string'], 'nested!')}</div>;`,
    ),

    output: withFbtImportStatement(
      `import React from 'react';
      var x = React.createElement(
        'div',
        null,
        fbt._(
          ${payload({
            jsfbt: {
              m: [],
              t: {
                desc: 'nested!',
                text: 'A nested string',
              },
            },
          })},
        ),
      );`,
    ),
  },

  'should convert simple strings': {
    input: withFbtImportStatement(
      `var x = fbt('A simple string', "It's simple");`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'A simple string',
        ],
        "It's simple",
      );`,
    ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [],
            t: {
              desc: "It's simple",
              text: 'A simple string',
            },
          },
        })},
      );`,
    ),
  },

  'should deduplicate branches when fbt.enum() calls share the same key': {
    input: withFbtImportStatement(
      `var x = fbt(
        'Look! ' +
          fbt.enum('groups', {
            groups: 'Groups',
            photos: 'Photos',
            videos: 'Videos',
          }) +
          ' and ' +
          fbt.enum('groups', {
            groups: 'groups',
            photos: 'photos',
            videos: 'videos',
          }) +
          '!',
        'enums!',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'Look! ',
          fbt.enum('groups', {
            groups: 'Groups',
            photos: 'Photos',
            videos: 'Videos',
          }),
          ' and ',
          fbt.enum('groups', {
            groups: 'groups',
            photos: 'photos',
            videos: 'videos',
          }),
          '!'
        ], 'enums!',
      );`,
    ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [null],
            t: {
              groups: {
                desc: 'enums!',
                text: 'Look! Groups and groups!',
              },
              photos: {
                desc: 'enums!',
                text: 'Look! Photos and photos!',
              },
              videos: {
                desc: 'enums!',
                text: 'Look! Videos and videos!',
              },
            },
          },
        })},
        [
          fbt._enum('groups', {
            "groups": 'Groups',
            "photos": 'Photos',
            "videos": 'Videos',
          }),
        ],
      );`,
    ),
  },

  'should deduplicate branches when fbt.enum() calls share the same key in string templates':
    {
      input: withFbtImportStatement(
        `var x = fbt(
          \`Look!  \${fbt.enum('groups', {
            groups: 'Groups',
            photos: 'Photos',
            videos: 'Videos',
          })}  and  \${fbt.enum('groups', {
            "groups": 'groups',
            "photos": 'photos',
            "videos": 'videos',
          })}!\`,
          'enums!',
        );`,
      ),

      output: withFbtImportStatement(
        `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [null],
            t: {
              groups: {
                desc: 'enums!',
                text: 'Look! Groups and groups!',
              },
              photos: {
                desc: 'enums!',
                text: 'Look! Photos and photos!',
              },
              videos: {
                desc: 'enums!',
                text: 'Look! Videos and videos!',
              },
            },
          },
        })},
        [
          fbt._enum('groups', {
            "groups": 'Groups',
            "photos": 'Photos',
            "videos": 'Videos',
          }),
        ],
      );`,
      ),
    },

  'should get project from docblock': {
    input: `/** @fbt {"project": "dev"}*/
      ${withFbtImportStatement(
        `var x = fbt('Also simple string', "It's simple");`,
      )}`,

    inputWithArraySyntax: `/** @fbt {"project": "dev"}*/
      ${withFbtImportStatement(
        `var x = fbt(['Also simple string'], "It's simple");`,
      )}`,

    output: `/** @fbt {"project": "dev"}*/
      ${withFbtImportStatement(
        `var x = fbt._(
          ${payload({
            jsfbt: {
              m: [],
              t: {
                desc: "It's simple",
                text: 'Also simple string',
              },
            },
            project: 'dev',
          })},
        );`,
      )}`,
  },

  'should handle JSX fbt with multiple levels of nested strings': {
    input: '',
    inputWithArraySyntax: withFbtImportStatement(
      `import React from 'react';
      <fbt desc="example 1">
        <b className="padRight">
          <fbt:enum enum-range={['today', 'yesterday']} value={enumVal} />
        </b>,
        <fbt:param name="name" gender={viewerGender}>
          <b className="padRight">{viewerName}</b>
        </fbt:param>
        has shared
        <a className="neatoLink" href="#">
          <fbt:plural many="photos" showCount="ifMany" count={photoCount}>
            a photo
          </fbt:plural>{' '}
          with
          <strong>
            <fbt:pronoun
              type="object"
              gender={otherGender}
              human="true" />
          </strong>
        </a>
      </fbt>;`,
    ),
    /* eslint-disable sort-keys-fix/sort-keys-fix */
    output: `
      var fbt_sv_arg_0, fbt_sv_arg_1, fbt_sv_arg_2, fbt_sv_arg_3;
      import { fbt } from "fbtee";
      import React from 'react';
      (
        fbt_sv_arg_0 = fbt._enum(enumVal, {"today": "today", "yesterday": "yesterday"}),
        fbt_sv_arg_1 = fbt._param(
          "name",
          /*#__PURE__*/React.createElement(
            "b",
            {className: "padRight"},
            viewerName,
          ),
          [1, viewerGender],
        ),
        fbt_sv_arg_2 = fbt._plural(photoCount, "number"),
        fbt_sv_arg_3 = fbt._pronoun(0, otherGender, {human: 1}),
        fbt._(${payload({
          jsfbt: {
            m: [
              null,
              { token: 'name', type: 1 },
              { singular: true, token: 'number', type: 2 },
              null,
            ],
            t: {
              today: {
                '*': {
                  '*': {
                    '*': {
                      desc: 'example 1',
                      text: '{=today}, {name} has shared {=[number] photos with them}',
                      tokenAliases: {
                        '=today': '=m0',
                        '=[number] photos with them': '=m4',
                      },
                    },
                    1: {
                      desc: 'example 1',
                      text: '{=today}, {name} has shared {=[number] photos with her}',
                      tokenAliases: {
                        '=today': '=m0',
                        '=[number] photos with her': '=m4',
                      },
                    },
                    2: {
                      desc: 'example 1',
                      text: '{=today}, {name} has shared {=[number] photos with him}',
                      tokenAliases: {
                        '=today': '=m0',
                        '=[number] photos with him': '=m4',
                      },
                    },
                  },
                  _1: {
                    '*': {
                      desc: 'example 1',
                      text: '{=today}, {name} has shared {=a photo with them}',
                      tokenAliases: {
                        '=today': '=m0',
                        '=a photo with them': '=m4',
                      },
                    },
                    1: {
                      desc: 'example 1',
                      text: '{=today}, {name} has shared {=a photo with her}',
                      tokenAliases: {
                        '=today': '=m0',
                        '=a photo with her': '=m4',
                      },
                    },
                    2: {
                      desc: 'example 1',
                      text: '{=today}, {name} has shared {=a photo with him}',
                      tokenAliases: {
                        '=today': '=m0',
                        '=a photo with him': '=m4',
                      },
                    },
                  },
                },
              },
              yesterday: {
                '*': {
                  '*': {
                    '*': {
                      desc: 'example 1',
                      text: '{=yesterday}, {name} has shared {=[number] photos with them}',
                      tokenAliases: {
                        '=yesterday': '=m0',
                        '=[number] photos with them': '=m4',
                      },
                    },
                    1: {
                      desc: 'example 1',
                      text: '{=yesterday}, {name} has shared {=[number] photos with her}',
                      tokenAliases: {
                        '=yesterday': '=m0',
                        '=[number] photos with her': '=m4',
                      },
                    },
                    2: {
                      desc: 'example 1',
                      text: '{=yesterday}, {name} has shared {=[number] photos with him}',
                      tokenAliases: {
                        '=yesterday': '=m0',
                        '=[number] photos with him': '=m4',
                      },
                    },
                  },
                  _1: {
                    '*': {
                      desc: 'example 1',
                      text: '{=yesterday}, {name} has shared {=a photo with them}',
                      tokenAliases: {
                        '=yesterday': '=m0',
                        '=a photo with them': '=m4',
                      },
                    },
                    1: {
                      desc: 'example 1',
                      text: '{=yesterday}, {name} has shared {=a photo with her}',
                      tokenAliases: {
                        '=yesterday': '=m0',
                        '=a photo with her': '=m4',
                      },
                    },
                    2: {
                      desc: 'example 1',
                      text: '{=yesterday}, {name} has shared {=a photo with him}',
                      tokenAliases: {
                        '=yesterday': '=m0',
                        '=a photo with him': '=m4',
                      },
                    },
                  },
                },
              },
            },
          },
          project: '',
        })},
        [
        fbt_sv_arg_0,
        fbt_sv_arg_1,
        fbt_sv_arg_2,
        fbt_sv_arg_3,
        fbt._implicitParam(
          "=m0",
          /*#__PURE__*/React.createElement(
            "b",
            {className: "padRight"},
            fbt._(
              ${payload({
                jsfbt: {
                  m: [
                    null,
                    { token: 'name', type: 1 },
                    { singular: true, token: 'number', type: 2 },
                    null,
                  ],
                  t: {
                    today: {
                      '*': {
                        '*': {
                          '*': {
                            desc: 'In the phrase: "{=today}, {name} has shared {=[number] photos with them}"',
                            text: 'today',
                          },
                          1: {
                            desc: 'In the phrase: "{=today}, {name} has shared {=[number] photos with her}"',
                            text: 'today',
                          },
                          2: {
                            desc: 'In the phrase: "{=today}, {name} has shared {=[number] photos with him}"',
                            text: 'today',
                          },
                        },
                        _1: {
                          '*': {
                            desc: 'In the phrase: "{=today}, {name} has shared {=a photo with them}"',
                            text: 'today',
                          },
                          1: {
                            desc: 'In the phrase: "{=today}, {name} has shared {=a photo with her}"',
                            text: 'today',
                          },
                          2: {
                            desc: 'In the phrase: "{=today}, {name} has shared {=a photo with him}"',
                            text: 'today',
                          },
                        },
                      },
                    },
                    yesterday: {
                      '*': {
                        '*': {
                          '*': {
                            desc: 'In the phrase: "{=yesterday}, {name} has shared {=[number] photos with them}"',
                            text: 'yesterday',
                          },
                          1: {
                            desc: 'In the phrase: "{=yesterday}, {name} has shared {=[number] photos with her}"',
                            text: 'yesterday',
                          },
                          2: {
                            desc: 'In the phrase: "{=yesterday}, {name} has shared {=[number] photos with him}"',
                            text: 'yesterday',
                          },
                        },
                        _1: {
                          '*': {
                            desc: 'In the phrase: "{=yesterday}, {name} has shared {=a photo with them}"',
                            text: 'yesterday',
                          },
                          1: {
                            desc: 'In the phrase: "{=yesterday}, {name} has shared {=a photo with her}"',
                            text: 'yesterday',
                          },
                          2: {
                            desc: 'In the phrase: "{=yesterday}, {name} has shared {=a photo with him}"',
                            text: 'yesterday',
                          },
                        },
                      },
                    },
                  },
                },
                project: '',
              })},
              [
                fbt_sv_arg_0,
                fbt_sv_arg_1,
                fbt_sv_arg_2,
                fbt_sv_arg_3,
              ]
            )
          )
        ),

        fbt._implicitParam(
          "=m4",
          /*#__PURE__*/React.createElement(
            "a",
            {className: "neatoLink", href: "#"},
            fbt._(
              ${payload({
                jsfbt: {
                  m: [
                    null,
                    { token: 'name', type: 1 },
                    { singular: true, token: 'number', type: 2 },
                    null,
                  ],
                  t: {
                    today: {
                      '*': {
                        '*': {
                          '*': {
                            desc: 'In the phrase: "{=today}, {name} has shared {=[number] photos with them}"',
                            text: '{number} photos with {=them}',
                            tokenAliases: { '=them': '=m4' },
                          },
                          1: {
                            desc: 'In the phrase: "{=today}, {name} has shared {=[number] photos with her}"',
                            text: '{number} photos with {=her}',
                            tokenAliases: { '=her': '=m4' },
                          },
                          2: {
                            desc: 'In the phrase: "{=today}, {name} has shared {=[number] photos with him}"',
                            text: '{number} photos with {=him}',
                            tokenAliases: { '=him': '=m4' },
                          },
                        },
                        _1: {
                          '*': {
                            desc: 'In the phrase: "{=today}, {name} has shared {=a photo with them}"',
                            text: 'a photo with {=them}',
                            tokenAliases: { '=them': '=m4' },
                          },
                          1: {
                            desc: 'In the phrase: "{=today}, {name} has shared {=a photo with her}"',
                            text: 'a photo with {=her}',
                            tokenAliases: { '=her': '=m4' },
                          },
                          2: {
                            desc: 'In the phrase: "{=today}, {name} has shared {=a photo with him}"',
                            text: 'a photo with {=him}',
                            tokenAliases: { '=him': '=m4' },
                          },
                        },
                      },
                    },
                    yesterday: {
                      '*': {
                        '*': {
                          '*': {
                            desc: 'In the phrase: "{=yesterday}, {name} has shared {=[number] photos with them}"',
                            text: '{number} photos with {=them}',
                            tokenAliases: { '=them': '=m4' },
                          },
                          1: {
                            desc: 'In the phrase: "{=yesterday}, {name} has shared {=[number] photos with her}"',
                            text: '{number} photos with {=her}',
                            tokenAliases: { '=her': '=m4' },
                          },
                          2: {
                            desc: 'In the phrase: "{=yesterday}, {name} has shared {=[number] photos with him}"',
                            text: '{number} photos with {=him}',
                            tokenAliases: { '=him': '=m4' },
                          },
                        },
                        _1: {
                          '*': {
                            desc: 'In the phrase: "{=yesterday}, {name} has shared {=a photo with them}"',
                            text: 'a photo with {=them}',
                            tokenAliases: { '=them': '=m4' },
                          },
                          1: {
                            desc: 'In the phrase: "{=yesterday}, {name} has shared {=a photo with her}"',
                            text: 'a photo with {=her}',
                            tokenAliases: { '=her': '=m4' },
                          },
                          2: {
                            desc: 'In the phrase: "{=yesterday}, {name} has shared {=a photo with him}"',
                            text: 'a photo with {=him}',
                            tokenAliases: { '=him': '=m4' },
                          },
                        },
                      },
                    },
                  },
                },
                project: '',
              })},
              [
                fbt_sv_arg_0,
                fbt_sv_arg_1,
                fbt_sv_arg_2,
                fbt_sv_arg_3,
                fbt._implicitParam(
                  "=m4",
                  /*#__PURE__*/React.createElement(
                    "strong",
                    null,
                    fbt._(
                      ${payload({
                        jsfbt: {
                          m: [
                            null,
                            { token: 'name', type: 1 },
                            { singular: true, token: 'number', type: 2 },
                            null,
                          ],
                          t: {
                            today: {
                              '*': {
                                '*': {
                                  '*': {
                                    desc: 'In the phrase: "{=today}, {name} has shared {number} photos with {=them}"',
                                    text: 'them',
                                  },
                                  1: {
                                    desc: 'In the phrase: "{=today}, {name} has shared {number} photos with {=her}"',
                                    text: 'her',
                                  },
                                  2: {
                                    desc: 'In the phrase: "{=today}, {name} has shared {number} photos with {=him}"',
                                    text: 'him',
                                  },
                                },
                                _1: {
                                  '*': {
                                    desc: 'In the phrase: "{=today}, {name} has shared a photo with {=them}"',
                                    text: 'them',
                                  },
                                  1: {
                                    desc: 'In the phrase: "{=today}, {name} has shared a photo with {=her}"',
                                    text: 'her',
                                  },
                                  2: {
                                    desc: 'In the phrase: "{=today}, {name} has shared a photo with {=him}"',
                                    text: 'him',
                                  },
                                },
                              },
                            },
                            yesterday: {
                              '*': {
                                '*': {
                                  '*': {
                                    desc: 'In the phrase: "{=yesterday}, {name} has shared {number} photos with {=them}"',
                                    text: 'them',
                                  },
                                  1: {
                                    desc: 'In the phrase: "{=yesterday}, {name} has shared {number} photos with {=her}"',
                                    text: 'her',
                                  },
                                  2: {
                                    desc: 'In the phrase: "{=yesterday}, {name} has shared {number} photos with {=him}"',
                                    text: 'him',
                                  },
                                },
                                _1: {
                                  '*': {
                                    desc: 'In the phrase: "{=yesterday}, {name} has shared a photo with {=them}"',
                                    text: 'them',
                                  },
                                  1: {
                                    desc: 'In the phrase: "{=yesterday}, {name} has shared a photo with {=her}"',
                                    text: 'her',
                                  },
                                  2: {
                                    desc: 'In the phrase: "{=yesterday}, {name} has shared a photo with {=him}"',
                                    text: 'him',
                                  },
                                },
                              },
                            },
                          },
                        },
                        project: '',
                      })},
                      [
                        fbt_sv_arg_0,
                        fbt_sv_arg_1,
                        fbt_sv_arg_2,
                        fbt_sv_arg_3,
                      ]
                    )
                  )
                )
              ]
            )
          )
        )
      ]));`,
    /* eslint-enable sort-keys-fix/sort-keys-fix */
  },

  'should handle JSX fbt with two nested React elements': {
    input: '',
    inputWithArraySyntax: withFbtImportStatement(
      `import React from 'react';
      <fbt desc="example 1">
        <fbt:param name="name" gender={this.state.ex1Gender}>
          <b className="padRight">{this.state.ex1Name}</b>
        </fbt:param>
        has shared
        <a className="neatoLink" href="#" tabindex={123} id={"uniq"}>
          <strong>
            <fbt:plural
              many="photos"
              showCount="ifMany"
              count={this.state.ex1Count}>
              a photo
            </fbt:plural>
          </strong>
        </a>
        with you
      </fbt>;`,
    ),

    output: `
      var fbt_sv_arg_0, fbt_sv_arg_1;
      import { fbt } from 'fbtee';
      import React from 'react';
      (
        fbt_sv_arg_0 = fbt._param(
          "name",
          /*#__PURE__*/React.createElement(
            "b",
            {className: "padRight"},
            this.state.ex1Name,
          ),
          [1, this.state.ex1Gender],
        ),
        fbt_sv_arg_1 = fbt._plural(this.state.ex1Count, "number"),
        fbt._(
        ${payload({
          jsfbt: {
            m: [
              {
                token: 'name',
                type: 1,
              },
              {
                singular: true,
                token: 'number',
                type: 2,
              },
            ],
            t: {
              '*': {
                '*': {
                  desc: 'example 1',
                  text: '{name} has shared {=[number] photos} with you',
                  tokenAliases: { '=[number] photos': '=m2' },
                },
                _1: {
                  desc: 'example 1',
                  text: '{name} has shared {=a photo} with you',
                  tokenAliases: { '=a photo': '=m2' },
                },
              },
            },
          },
          project: '',
        })},
        [
          fbt_sv_arg_0,
          fbt_sv_arg_1,
          fbt._implicitParam(
            "=m2",
            /*#__PURE__*/React.createElement(
              "a",
              {
                className: "neatoLink",
                href: "#",
                tabindex: 123,
                id: "uniq",
              },
              fbt._(
                ${payload({
                  jsfbt: {
                    m: [
                      {
                        token: 'name',
                        type: 1,
                      },
                      {
                        singular: true,
                        token: 'number',
                        type: 2,
                      },
                    ],
                    t: {
                      '*': {
                        '*': {
                          desc: 'In the phrase: "{name} has shared {=[number] photos} with you"',
                          text: '{=[number] photos}',
                          tokenAliases: { '=[number] photos': '=m1' },
                        },
                        _1: {
                          desc: 'In the phrase: "{name} has shared {=a photo} with you"',
                          text: '{=a photo}',
                          tokenAliases: { '=a photo': '=m1' },
                        },
                      },
                    },
                  },
                  project: '',
                })},
                [
                  fbt_sv_arg_0,
                  fbt_sv_arg_1,
                  fbt._implicitParam(
                    "=m1",
                    /*#__PURE__*/React.createElement(
                      "strong",
                      null,
                      fbt._(
                        ${payload({
                          jsfbt: {
                            m: [
                              {
                                token: 'name',
                                type: 1,
                              },
                              {
                                singular: true,
                                token: 'number',
                                type: 2,
                              },
                            ],
                            t: {
                              '*': {
                                '*': {
                                  desc: 'In the phrase: "{name} has shared {=[number] photos} with you"',
                                  text: '{number} photos',
                                },
                                _1: {
                                  desc: 'In the phrase: "{name} has shared {=a photo} with you"',
                                  text: 'a photo',
                                },
                              },
                            },
                          },
                          project: '',
                        })},
                        [
                          fbt_sv_arg_0,
                          fbt_sv_arg_1,
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          )
        ]
      ));`,
  },

  'should handle a JSX fragment nested with fbt.param as an argument': {
    input: '',
    inputWithArraySyntax: withFbtImportStatement(
      `import React from 'react';
      var x = fbt(
        [
          'A1 ',
          <a>
            B1
            <b>
              C1
              {
                // fbt constructs like fbt.pronoun() should return some opaque type
                // like FbtElement to work with React components
              }
              {fbt.param('paramName', paramValue)}
              C2
            </b>
            B2
          </a>,
          ' A2',
        ],
        'string with nested JSX fragments',
        {
          subject: subjectValue,
        }
      );`,
    ),

    output: `
      var fbt_sv_arg_0;
      import { fbt } from "fbtee";
      import React from 'react';
      var x = (fbt_sv_arg_0 = fbt._subject(subjectValue), fbt._(
        ${payload({
          jsfbt: {
            m: [{ token: '__subject__', type: 1 }],
            t: {
              '*': {
                desc: 'string with nested JSX fragments',
                text: 'A1 {=B1 C1 [paramName] C2 B2} A2',
                tokenAliases: { '=B1 C1 [paramName] C2 B2': '=m1' },
              },
            },
          },
        })},
        [
          fbt_sv_arg_0,
          fbt._implicitParam(
            "=m1",
            /*#__PURE__*/React.createElement(
              "a",
              null,
              fbt._(
                ${payload({
                  jsfbt: {
                    m: [{ token: '__subject__', type: 1 }],
                    t: {
                      '*': {
                        desc: 'In the phrase: "A1 {=B1 C1 [paramName] C2 B2} A2"',
                        text: 'B1 {=C1 [paramName] C2} B2',
                        tokenAliases: { '=C1 [paramName] C2': '=m1' },
                      },
                    },
                  },
                })},
                [
                  fbt_sv_arg_0,
                  fbt._implicitParam(
                    "=m1",
                    /*#__PURE__*/React.createElement(
                      "b",
                      null,
                      fbt._(
                        ${payload({
                          jsfbt: {
                            m: [{ token: '__subject__', type: 1 }],
                            t: {
                              '*': {
                                desc: 'In the phrase: "A1 B1 {=C1 [paramName] C2} B2 A2"',
                                text: 'C1 {paramName} C2',
                              },
                            },
                          },
                        })},
                        [
                          fbt_sv_arg_0,
                          fbt._param('paramName', paramValue)
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ))`,
  },

  'should handle duplicate enums': {
    input: withFbtImportStatement(
      `var x = fbt(
        'Look! ' +
          fbt.enum('groups', {
            groups: 'Groups',
            photos: 'Photos',
            videos: 'Videos',
          }) +
          ' and ' +
          fbt.enum('groups', {
            groups: 'groups',
            photos: 'photos',
            videos: 'videos',
          }) +
          '!',
        'enums!',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'Look! ',
          fbt.enum('groups', {
            groups: 'Groups',
            photos: 'Photos',
            videos: 'Videos',
          }),
          ' and ',
          fbt.enum('groups', {
            groups: 'groups',
            photos: 'photos',
            videos: 'videos',
          }),
          '!',
        ],
        'enums!',
      );`,
    ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [null],
            t: {
              groups: {
                desc: 'enums!',
                text: 'Look! Groups and groups!',
              },
              photos: {
                desc: 'enums!',
                text: 'Look! Photos and photos!',
              },
              videos: {
                desc: 'enums!',
                text: 'Look! Videos and videos!',
              },
            },
          },
        })},
        [
          fbt._enum('groups', {
            "groups": 'Groups',
            "photos": 'Photos',
            "videos": 'Videos',
          }),
        ],
      );`,
    ),
  },

  'should handle enums (with array values)': {
    input: withFbtImportStatement(
      `var x = fbt(
        'Click to see ' + fbt.enum('groups', ['groups', 'photos', 'videos']),
        'enum as an array',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'Click to see ',
          fbt.enum('groups', ['groups', 'photos', 'videos']),
        ],
        'enum as an array',
      );`,
    ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [null],
            t: {
              groups: {
                desc: 'enum as an array',
                text: 'Click to see groups',
              },
              photos: {
                desc: 'enum as an array',
                text: 'Click to see photos',
              },
              videos: {
                desc: 'enum as an array',
                text: 'Click to see videos',
              },
            },
          },
        })},
        [
          fbt._enum('groups', {
            "groups": 'groups',
            "photos": 'photos',
            "videos": 'videos',
          }),
        ],
      );`,
    ),
  },

  'should handle enums (with enum range as variable)': {
    input: withFbtImportStatement(
      `var aEnum = require('Test$FbtEnum');
      var x = fbt(
        'Click to see ' + fbt.enum('id1', aEnum),
        'enum as an array',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var aEnum = require('Test$FbtEnum');
      var x = fbt(
        [
          'Click to see ',
          fbt.enum('id1', aEnum),
        ],
        'enum as an array',
      );`,
    ),

    output: withFbtImportStatement(
      `var aEnum = require('Test$FbtEnum');
      var x = fbt._(
        ${payload({
          jsfbt: {
            m: [null],
            t: {
              id1: {
                desc: 'enum as an array',
                text: 'Click to see groups',
              },
              id2: {
                desc: 'enum as an array',
                text: 'Click to see photos',
              },
              id3: {
                desc: 'enum as an array',
                text: 'Click to see videos',
              },
            },
          },
        })},
        [fbt._enum('id1', aEnum)],
      );`,
    ),

    runWithTestFbtEnumManifest: TestFbtEnumManifest,
  },

  'should handle enums (with value map)': {
    input: withFbtImportStatement(
      `var x = fbt(
        'Click to see ' +
          fbt.enum('id1', {id1: 'groups', id2: 'photos', id3: 'videos'}),
        'enum as an object',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'Click to see ',
          fbt.enum('id1', {id1: 'groups', id2: 'photos', id3: 'videos'}),
        ],
        'enum as an object',
      );`,
    ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [null],
            t: {
              id1: {
                desc: 'enum as an object',
                text: 'Click to see groups',
              },
              id2: {
                desc: 'enum as an object',
                text: 'Click to see photos',
              },
              id3: {
                desc: 'enum as an object',
                text: 'Click to see videos',
              },
            },
          },
        })},
        [
          fbt._enum('id1', {
            "id1": 'groups',
            "id2": 'photos',
            "id3": 'videos'
          })
        ],
      );`,
    ),
  },

  'should handle enums with more text after': {
    input: withFbtImportStatement(
      `var x = fbt(
        'Hello, ' + fbt.enum('groups', ['groups', 'photos', 'videos']) + '!',
        'enums!',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'Hello, ',
          fbt.enum('groups', ['groups', 'photos', 'videos']),
          '!',
        ], 'enums!',
      );`,
    ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [null],
            t: {
              groups: {
                desc: 'enums!',
                text: 'Hello, groups!',
              },
              photos: {
                desc: 'enums!',
                text: 'Hello, photos!',
              },
              videos: {
                desc: 'enums!',
                text: 'Hello, videos!',
              },
            },
          },
        })},
        [
          fbt._enum('groups', {
            "groups": 'groups',
            "photos": 'photos',
            "videos": 'videos',
          }),
        ],
      );`,
    ),
  },

  'should handle multiple plurals with no showCount (i.e. no named params)': {
    input: withFbtImportStatement(
      `var x = fbt(
        'There ' +
        fbt.plural('is ', count, {many: 'are '}) +
        fbt.plural('a like', count, {showCount: 'ifMany', many: 'likes'}),
        'plurals',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'There ',
          fbt.plural('is ', count, {many: 'are '}),
          fbt.plural('a like', count, {showCount: 'ifMany', many: 'likes'}),
        ], 'plurals',
      );`,
    ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [
              null,
              {
                singular: true,
                token: 'number',
                type: FbtVariationType.NUMBER,
              },
            ],
            t: {
              '*': {
                '*': {
                  desc: 'plurals',
                  text: 'There are {number} likes',
                },
              },
              _1: {
                _1: {
                  desc: 'plurals',
                  text: 'There is a like',
                },
              },
            },
          },
        })},
        [fbt._plural(count), fbt._plural(count, 'number')],
      );`,
    ),
  },

  'should handle names': {
    input: withFbtImportStatement(
      `var x = fbt(
        'You just friended ' + fbt.name('name', personname, gender),
        'names',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'You just friended ',
          fbt.name('name', personname, gender),
        ], 'names',
      );`,
    ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [
              {
                token: 'name',
                type: FbtVariationType.GENDER,
              },
            ],
            t: {
              '*': {
                desc: 'names',
                text: 'You just friended {name}',
              },
            },
          },
        })},
        [fbt._name('name', personname, gender)],
      );`,
    ),
  },

  'should handle object pronoun': {
    input: withFbtImportStatement(
      `var x = fbt(
          'I know ' +
            fbt.pronoun('object', gender) +
            '.',
          'object pronoun',
        );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
          [
            'I know ',
            fbt.pronoun('object', gender),
            '.'
          ],
          'object pronoun',
        );`,
    ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [null],
            t: {
              '*': {
                desc: 'object pronoun',
                text: 'I know them.',
              },
              0: {
                desc: 'object pronoun',
                text: 'I know this.',
              },
              1: {
                desc: 'object pronoun',
                text: 'I know her.',
              },
              2: {
                desc: 'object pronoun',
                text: 'I know him.',
              },
            },
          },
        })},
        [fbt._pronoun(0, gender)],
      );`,
    ),
  },

  'should handle params': {
    input: withFbtImportStatement(
      `var x = fbt(
        'A parameterized message to ' +
          fbt.param('personName', truthy ? ifTrue : ifFalse),
        'Moar params',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'A parameterized message to ',
          fbt.param('personName', truthy ? ifTrue : ifFalse),
        ],
        'Moar params',
      );`,
    ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [],
            t: {
              desc: 'Moar params',
              text: 'A parameterized message to {personName}',
            },
          },
        })},
        [fbt._param('personName', truthy ? ifTrue : ifFalse)],
      );`,
    ),
  },

  'should handle plurals that have different count variables': {
    input: withFbtImportStatement(
      `var x = fbt(
        fbt.plural('cat', catCount, {name: 'cat_token', showCount: 'yes'}) +
        ' and ' +
        fbt.plural('dog', dogCount, {name: 'dog_token', showCount: 'yes'}),
        'plurals',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          fbt.plural('cat', catCount, {name: 'cat_token', showCount: 'yes'}),
          ' and ',
          fbt.plural('dog', dogCount, {name: 'dog_token', showCount: 'yes'}),
        ],
        'plurals',
      )`,
    ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [
              {
                singular: true,
                token: 'cat_token',
                type: FbtVariationType.NUMBER,
              },
              {
                singular: true,
                token: 'dog_token',
                type: FbtVariationType.NUMBER,
              },
            ],
            t: {
              '*': {
                '*': {
                  desc: 'plurals',
                  text: '{cat_token} cats and {dog_token} dogs',
                },
                _1: {
                  desc: 'plurals',
                  text: '{cat_token} cats and 1 dog',
                },
              },
              _1: {
                '*': {
                  desc: 'plurals',
                  text: '1 cat and {dog_token} dogs',
                },
                _1: {
                  desc: 'plurals',
                  text: '1 cat and 1 dog',
                },
              },
            },
          },
          project: '',
        })},
        [
          fbt._plural(catCount, 'cat_token'),
          fbt._plural(dogCount, 'dog_token'),
        ],
      );`,
    ),
  },

  'should handle plurals that share the same count variable': {
    input: withFbtImportStatement(
      `var x = fbt(
        'There ' +
          fbt.plural('was ', count, {showCount: 'no', many: 'were '}) +
          fbt.plural('a like', count, {showCount: 'ifMany', many: 'likes'}),
        'plurals',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'There ',
          fbt.plural('was ', count, {showCount: 'no', many: 'were '}),
          fbt.plural('a like', count, {showCount: 'ifMany', many: 'likes'}),
        ],
        'plurals',
      )`,
    ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [
              null,
              {
                singular: true,
                token: 'number',
                type: FbtVariationType.NUMBER,
              },
            ],
            t: {
              '*': {
                '*': {
                  desc: 'plurals',
                  text: 'There were {number} likes',
                },
              },
              _1: {
                _1: {
                  desc: 'plurals',
                  text: 'There was a like',
                },
              },
            },
          },
        })},
        [fbt._plural(count), fbt._plural(count, 'number')],
      );`,
    ),
  },

  'should handle possessive pronoun': {
    input:
      // I.e. It is her birthday.
      withFbtImportStatement(
        `var x = fbt(
          'It is ' + fbt.pronoun('possessive', gender) + ' birthday.',
          'possessive pronoun',
        );`,
      ),

    inputWithArraySyntax:
      // I.e. It is her birthday.
      withFbtImportStatement(
        `var x = fbt(
          [
            'It is ',
            fbt.pronoun('possessive', gender),
            ' birthday.'
          ], 'possessive pronoun',
        );`,
      ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [null],
            t: {
              '*': {
                desc: 'possessive pronoun',
                text: 'It is their birthday.',
              },
              1: {
                desc: 'possessive pronoun',
                text: 'It is her birthday.',
              },
              2: {
                desc: 'possessive pronoun',
                text: 'It is his birthday.',
              },
            },
          },
        })},
        [fbt._pronoun(1, gender)],
      );`,
    ),
  },

  'should handle subject and reflexive pronouns': {
    input:
      // I.e. He wished himself a happy birthday.
      withFbtImportStatement(
        `var x = fbt(
          fbt.pronoun('subject', gender, {capitalize: true, human: true}) +
            ' wished ' +
            fbt.pronoun('reflexive', gender, {human: true}) +
            ' a happy birthday.',
          'subject+reflexive pronouns',
        );`,
      ),

    inputWithArraySyntax:
      // I.e. He wished himself a happy birthday.
      withFbtImportStatement(
        `var x = fbt(
          [
            fbt.pronoun('subject', gender, {capitalize: true, human: true}),
            ' wished ',
            fbt.pronoun('reflexive', gender, {human: true}),
            ' a happy birthday.'
          ], 'subject+reflexive pronouns',
        );`,
      ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [null, null],
            t: {
              '*': {
                '*': {
                  desc: 'subject+reflexive pronouns',
                  text: 'They wished themselves a happy birthday.',
                },
              },
              1: {
                1: {
                  desc: 'subject+reflexive pronouns',
                  text: 'She wished herself a happy birthday.',
                },
              },
              2: {
                2: {
                  desc: 'subject+reflexive pronouns',
                  text: 'He wished himself a happy birthday.',
                },
              },
            },
          },
        })},
        [
          fbt._pronoun(3, gender, {human: 1}),
          fbt._pronoun(2, gender, {human: 1})
        ],
      );`,
    ),
  },

  'should handle variations': {
    input: withFbtImportStatement(
      `var x = fbt(
        'Click to see ' + fbt.param('count', c, {number: true}) + ' links',
        'variations!',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'Click to see ',
          fbt.param('count', c, {number: true}),
          ' links',
        ], 'variations!',
      );`,
    ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [
              {
                token: 'count',
                type: FbtVariationType.NUMBER,
              },
            ],
            t: {
              '*': {
                desc: 'variations!',
                text: 'Click to see {count} links',
              },
            },
          },
        })},
        [fbt._param('count', c, [0])],
      );`,
    ),
  },

  'should handle variations + same param': {
    input: withFbtImportStatement(
      `var val = 42;
      fbt(
        'You have ' +
        fbt.param('count', val, {number: true}) +
        ' likes. Comment on it to get more than ' +
        fbt.sameParam('count') +
        ' likes',
        'test variations + sameParam',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var val = 42;
      fbt(
        [
          'You have ',
          fbt.param('count', val, {number: true}),
          ' likes. Comment on it to get more than ',
          fbt.sameParam('count'),
          ' likes',
        ], 'test variations + sameParam',
      );`,
    ),

    output: withFbtImportStatement(
      `var val = 42;
      fbt._(
        ${payload({
          jsfbt: {
            m: [
              {
                token: 'count',
                type: FbtVariationType.NUMBER,
              },
            ],
            t: {
              '*': {
                desc: 'test variations + sameParam',
                text: 'You have {count} likes. Comment on it to get more than {count} likes',
              },
            },
          },
        })},
        [fbt._param('count', val, [0])],
      );`,
    ),
  },

  'should handler wrapping parens': {
    input: withFbtImportStatement(
      `var x = fbt('foo' + 'bar' + 'baz' + 'qux', 'desc');
      var y = fbt('foo' + ('bar' + 'baz' + 'qux'), 'desc');
      var q = fbt('foo' + 'bar' + ('baz' + 'qux'), 'desc');`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          ('foo'),
          ('bar'),
          ('baz'),
          ('qux'),
        ], 'desc'
      );
      var y = fbt(
        [
          ('foo'),
          ('bar'),
          ('baz'),
          ('qux'),
        ], 'desc'
      );
      var q = fbt(
        [
          ('foo'),
          ('bar'),
          ('baz'),
          ('qux'),
        ], 'desc'
      );`,
    ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [],
            t: {
              desc: 'desc',
              text: 'foobarbazqux',
            },
          },
        })},
      );
      var y = fbt._(
        ${payload({
          jsfbt: {
            m: [],
            t: {
              desc: 'desc',
              text: 'foobarbazqux',
            },
          },
        })},
      );
      var q = fbt._(
        ${payload({
          jsfbt: {
            m: [],
            t: {
              desc: 'desc',
              text: 'foobarbazqux',
            },
          },
        })},
      );`,
    ),
  },

  'should insert param in place of fbt.sameParam if it exists': {
    input: withFbtImportStatement(
      `var z = fbt(
        fbt.param('name1', val1) + ' and ' + fbt.sameParam('name1'),
        'd',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var z = fbt(
        [
          fbt.param('name1', val1),
          ' and ',
          fbt.sameParam('name1'),
        ], 'd',
      );`,
    ),

    output: withFbtImportStatement(
      `var z = fbt._(
        ${payload({
          jsfbt: {
            m: [],
            t: {
              desc: 'd',
              text: '{name1} and {name1}',
            },
          },
        })},
        [fbt._param('name1', val1)],
      );`,
    ),
  },

  // Initially needed for JS source maps accuracy
  'should maintain intra-argument newlines': {
    input: withFbtImportStatement(
      `var z = fbt(
        fbt.param(
          'name1',
          foo ? (
            <a>
              bar
            </a>
          ) : (
            qux
          ),
        ) +
          ' blah ' +
          fbt.param('name2', qux),
        'a',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var z = fbt(
        [
          fbt.param(
            'name1',
            foo ? (
              <a>
                bar
              </a>
            ) : (
              qux
            ),
          ),
          ' blah ',
          fbt.param('name2', qux),
        ], 'a',
      );`,
    ),

    output: withFbtImportStatement(
      `var z = fbt._(
        ${payload({
          jsfbt: {
            m: [],
            t: {
              desc: 'a',
              text: '{name1} blah {name2}',
            },
          },
        })},
        [
          fbt._param(
            'name1',
            foo
              ? React.createElement(
                  "a",
                  null,
                  "bar",
                )
              : qux,
          ),
          fbt._param('name2', qux),
        ],
      );`,
    ),
  },

  'should maintain newlines': {
    input: withFbtImportStatement(
      `var x = fbt(
        'A simple string... ' +
        'with some other stuff.',
        'blah'
      );
      baz();`,
    ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [],
            t: {
              desc: 'blah',
              text: 'A simple string... with some other stuff.',
            },
          },
        })},
      );
      baz();`,
    ),
  },

  // Initially needed for JS source maps accuracy
  // This is useful only for testing column/line coordinates
  // Newlines are not preserved in the extracted fbt string
  'should maintain newlines when using string templates': {
    input: withFbtImportStatement(
      `var x = fbt(
        \`A simple string...
with some other stuff.\`,
        'blah',
      );
      baz();`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          \`A simple string...
with some other stuff.\`
        ],
        'blah',
      );
      baz();`,
    ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [],
            t: {
              desc: 'blah',
              text: 'A simple string... with some other stuff.',
            },
          },
        })},
      );
      baz();`,
    ),
  },

  // Initially needed for JS source maps accuracy
  'should maintain newlines within arguments': {
    input: withFbtImportStatement(
      `var z = fbt(
        'a' +
        ' b ' +
        fbt.param('name1', val1) +
        ' c ' +
        // comments
        ' d ' +
        fbt.param('name2', val2) +
        ' e ',
        'a',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var z = fbt(
        [
          'a',
          ' b ',
          fbt.param('name1', val1),
          ' c ',
          // comments
          ' d ',
          fbt.param('name2', val2),
          ' e ',
        ], 'a',
      );`,
    ),

    output: withFbtImportStatement(
      `var z = fbt._(
        ${payload({
          jsfbt: {
            m: [],
            t: {
              desc: 'a',
              text: 'a b {name1} c d {name2} e',
            },
          },
        })},
        [fbt._param('name1', val1), fbt._param('name2', val2)],
      );`,
    ),
  },

  'should not throw for string with a nested JSX fragment and string variation arguments':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var x = fbt(
          [
            'A1 ',
            <a>
              B1
              <b>
                C1
                {fbt.param('count', someRandomFunction(), {number: true})}
                C2
                {fbt.plural('cat', catCount, {value: someValueFunction(), name: 'cat_token', showCount: 'ifMany', many: 'cats'})}
              </b>
              B2
            </a>,
            ' A2',
          ],
          'string with nested JSX fragments',
        );`,
      ),

      output: `var fbt_sv_arg_0, fbt_sv_arg_1;
      import { fbt } from "fbtee";
      import React from 'react';
      var x = (
        fbt_sv_arg_0 = fbt._param("count", someRandomFunction(), [0]),
        fbt_sv_arg_1 = fbt._plural(catCount, "cat_token", someValueFunction()),
        fbt._(${payload({
          jsfbt: {
            m: [
              { token: 'count', type: 2 },
              { singular: true, token: 'cat_token', type: 2 },
            ],
            t: {
              '*': {
                '*': {
                  desc: 'string with nested JSX fragments',
                  text: 'A1 {=B1 C1 [count] C2 [cat_token] cats B2} A2',
                  tokenAliases: {
                    '=B1 C1 [count] C2 [cat_token] cats B2': '=m1',
                  },
                },
                _1: {
                  desc: 'string with nested JSX fragments',
                  text: 'A1 {=B1 C1 [count] C2 cat B2} A2',
                  tokenAliases: { '=B1 C1 [count] C2 cat B2': '=m1' },
                },
              },
            },
          },
          project: '',
        })},
        [
          fbt_sv_arg_0,
          fbt_sv_arg_1,
          fbt._implicitParam("=m1", /*#__PURE__*/React.createElement("a", null, fbt._(${payload(
            {
              jsfbt: {
                m: [
                  { token: 'count', type: 2 },
                  { singular: true, token: 'cat_token', type: 2 },
                ],
                t: {
                  '*': {
                    '*': {
                      desc: 'In the phrase: "A1 {=B1 C1 [count] C2 [cat_token] cats B2} A2"',
                      text: 'B1 {=C1 [count] C2 [cat_token] cats} B2',
                      tokenAliases: {
                        '=C1 [count] C2 [cat_token] cats': '=m1',
                      },
                    },
                    _1: {
                      desc: 'In the phrase: "A1 {=B1 C1 [count] C2 cat B2} A2"',
                      text: 'B1 {=C1 [count] C2 cat} B2',
                      tokenAliases: { '=C1 [count] C2 cat': '=m1' },
                    },
                  },
                },
              },
              project: '',
            },
          )},
          [
            fbt_sv_arg_0,
            fbt_sv_arg_1,
            fbt._implicitParam("=m1", /*#__PURE__*/React.createElement("b", null, fbt._(${payload(
              {
                jsfbt: {
                  m: [
                    { token: 'count', type: 2 },
                    { singular: true, token: 'cat_token', type: 2 },
                  ],
                  t: {
                    '*': {
                      '*': {
                        desc: 'In the phrase: "A1 B1 {=C1 [count] C2 [cat_token] cats} B2 A2"',
                        text: 'C1 {count} C2 {cat_token} cats',
                      },
                      _1: {
                        desc: 'In the phrase: "A1 B1 {=C1 [count] C2 cat} B2 A2"',
                        text: 'C1 {count} C2 cat',
                      },
                    },
                  },
                },
                project: '',
              },
            )}, [fbt_sv_arg_0, fbt_sv_arg_1])))])))]));`,
    },

  'should not throw when a fbt.param is nested inside a fbt which is nested inside a fbt.name':
    {
      input: withFbtImportStatement(
        `var z = fbt(
        'a ' +
        fbt.name(
          'name',
          fbt(
            fbt.param('paramName', val2),
            "desc inner",
          ),
          gender,
        ) +
        ' b',
        'desc',
      );`,
      ),

      inputWithArraySyntax: withFbtImportStatement(
        `var z = fbt(
        [
          'a ',
          fbt.name(
            'name',
            fbt(
              fbt.param('paramName', val2),
              "desc inner",
            ),
            gender,
          ),
          ' b',
        ], 'desc',
      );`,
      ),

      output: withFbtImportStatement(
        `var z = fbt._(
        ${payload({
          jsfbt: {
            m: [
              {
                token: 'name',
                type: 1,
              },
            ],
            t: {
              '*': {
                desc: 'desc',
                text: 'a {name} b',
              },
            },
          },
          project: '',
        })},
        [
          fbt._name(
            "name",
            fbt._(
              ${payload({
                jsfbt: {
                  m: [],
                  t: {
                    desc: 'desc inner',
                    text: '{paramName}',
                  },
                },
                project: '',
              })},
              [fbt._param("paramName", val2)],
            ),
            gender,
          ),
        ],
      );`,
      ),
    },

  'should respect the doNotExtract option': {
    input: withFbtImportStatement(
      `var x = fbt('A doNotExtract string', "should not be extracted", {doNotExtract: true});`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'A doNotExtract string',
        ],
        "should not be extracted",
        {doNotExtract: true}
      );`,
    ),

    output: withFbtImportStatement(
      `var x = fbt._(
        ${payload({
          jsfbt: {
            m: [],
            t: {
              desc: 'should not be extracted',
              text: 'A doNotExtract string',
            },
          },
        })},
      );`,
    ),
  },

  'should throw for string with a nested JSX fragment and string variation arguments that have nested class instantiation.':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var x = fbt(
          [
            'A1 ',
            <a>
              B1
              <b>
                C1
                {fbt.plural('world', (new SomeRandomClass(), value))}
              </b>
              B2
            </a>,
            ' A2',
          ],
          'string with nested JSX fragments',
        );`,
      ),

      throws:
        `Expected string variation runtime argument "count" ` +
        `to not contain a function call or class instantiation expression.`,
    },

  'should throw for string with a nested JSX fragment and string variation arguments that have nested function calls (fbt:enum).':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var x = fbt(
          [
            'A1 ',
            <a>
              B1
              <b>
                C1
                {fbt.enum(getValue(), ['world'])}
              </b>
              B2
            </a>,
            ' A2',
          ],
          'string with nested JSX fragments',
        );`,
      ),

      throws:
        `Expected string variation runtime argument "value" ` +
        `to not be a function call or class instantiation expression.`,
    },

  'should throw for string with a nested JSX fragment and string variation arguments that have nested function calls (fbt:name).':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var x = fbt(
          [
            'A1 ',
            <a>
              B1
              <b>
                C1
                {fbt.name('name', getName(), getGender())}
              </b>
              B2
            </a>,
            ' A2',
          ],
          'string with nested JSX fragments',
        );`,
      ),

      throws:
        `Expected string variation runtime argument "gender" ` +
        `to not be a function call or class instantiation expression.`,
    },

  'should throw for string with a nested JSX fragment and string variation arguments that have nested function calls (fbt:param with gender).':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var x = fbt(
          [
            'A1 ',
            <a>
              B1
              <b>
                C1
                {fbt.param('name', paramValue(), {gender: getGender()})}
              </b>
              B2
            </a>,
            ' A2',
          ],
          'string with nested JSX fragments',
        );`,
      ),

      throws:
        `Expected string variation runtime argument "gender" ` +
        `to not be a function call or class instantiation expression.`,
    },

  'should throw for string with a nested JSX fragment and string variation arguments that have nested function calls (fbt:param with number).':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var x = fbt(
          [
            'A1 ',
            <a>
              B1
              <b>
                C1
                {fbt.param('name', paramValue(), {number: getNumber()})}
              </b>
              B2
            </a>,
            ' A2',
          ],
          'string with nested JSX fragments',
        );`,
      ),

      throws:
        `Expected string variation runtime argument "number" ` +
        `to not be a function call or class instantiation expression.`,
    },

  'should throw for string with a nested JSX fragment and string variation arguments that have nested function calls (fbt:plural).':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var x = fbt(
          [
            'A1 ',
            <a>
              B1
              <b>
                C1
                {fbt.plural('world', getValue())}
              </b>
              B2
            </a>,
            ' A2',
          ],
          'string with nested JSX fragments',
        );`,
      ),

      throws:
        `Expected string variation runtime argument "count" ` +
        `to not be a function call or class instantiation expression.`,
    },

  'should throw for string with a nested JSX fragment and string variation arguments that have nested function calls (fbt:pronoun)':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var x = fbt(
          [
            'A1 ',
            <a>
              B1
              <b>
                C1
                {fbt.pronoun('object', getGender())}
              </b>
              B2
            </a>,
            ' A2',
          ],
          'string with nested JSX fragments',
        );`,
      ),

      throws:
        `Expected string variation runtime argument "gender" ` +
        `to not be a function call or class instantiation expression.`,
    },

  'should throw for string with a nested JSX fragment and subject gender contains function calls':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var x = fbt(
          [
            'A1 ',
            <a>
              B1
              <b>
                C1
              </b>
              B2
            </a>,
            ' A2',
          ],
          'string with nested JSX fragments',
          {
            subject: subjectValue(),
          }
        );`,
      ),

      throws:
        `Expected string variation runtime argument "subject" ` +
        `to not be a function call or class instantiation expression.`,
    },

  'should throw if the sameParam refers to a plural construct': {
    input: withFbtImportStatement(
      `var z = fbt(
        fbt.plural('cat', count, {value: someValueFunction(), name: 'tokenName', showCount: 'yes'}) + ' and ' + fbt.sameParam('tokenName'),
        'd',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var z = fbt(
        [
          fbt.plural('cat', count, {value: someValueFunction(), name: 'tokenName', showCount: 'yes'}),
          ' and ',
          fbt.sameParam('tokenName'),
        ], 'd',
      );`,
    ),

    throws:
      'Expected fbt `sameParam` construct with name=`tokenName` to refer to ' +
      'a `name` or `param` construct using the same token name',
  },

  'should throw if the token name of a sameParam construct in a nested string is not defined':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `var z = fbt(
        [
          fbt.param('name', val1),
          ' and ',
          <b>
            inner string
            {fbt.sameParam('name1')}
          </b>,
        ], 'd',
      );`,
      ),

      throws:
        'Expected fbt `sameParam` construct with name=`name1` to refer to ' +
        'a `name` or `param` construct using the same token name',
    },

  'should throw if the token name of a sameParam construct is not defined': {
    input: withFbtImportStatement(
      `var z = fbt(
        fbt.param('name1', val1) + ' and ' + fbt.sameParam('name2'),
        'd',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var z = fbt(
        [
          fbt.param('name1', val1),
          ' and ',
          fbt.sameParam('name2'),
        ], 'd',
      );`,
    ),

    throws:
      'Expected fbt `sameParam` construct with name=`name2` to refer to ' +
      'a `name` or `param` construct using the same token name',
  },

  'should throw on bad showCount value': {
    input: withFbtImportStatement(
      `var x = fbt(
        'There were ' + fbt.plural('a like', count, {showCount: 'badkey'}),
        'plurals',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'There were ',
          fbt.plural('a like', count, {showCount: 'badkey'}),
        ], 'plurals',
      );`,
    ),

    throws: `Option "showCount" has an invalid value: "badkey". Only allowed: ifMany, no, yes`,
  },

  'should throw on pronoun usage invalid': {
    input:
      // Note 'POSSESSION' instead of 'possessive'.
      withFbtImportStatement(
        `var x = fbt(
          'It is ' + fbt.pronoun('POSSESSION', gender) + ' birthday.',
          'throw because of unknown pronoun type',
        );`,
      ),

    inputWithArraySyntax:
      // Note 'POSSESSION' instead of 'possessive'.
      withFbtImportStatement(
        `var x = fbt(
          [
            'It is ',
            fbt.pronoun('POSSESSION', gender),
            ' birthday.'
          ], 'throw because of unknown pronoun type',
        );`,
      ),

    throws:
      `\`usage\`, the first argument of fbt.pronoun() - ` +
      `Expected value to be one of [object, possessive, reflexive, subject] ` +
      `but we got 'POSSESSION' (string) instead`,
  },

  'should throw on pronoun usage not StringLiteral': {
    input:
      // Note use of variable for pronoun usage.
      withFbtImportStatement(
        `var u = 'possessive';
        var x = fbt(
          'It is ' + fbt.pronoun(u, gender) + ' birthday.',
          'throw not StringLiteral',
        );`,
      ),

    inputWithArraySyntax:
      // Note use of variable for pronoun usage.
      withFbtImportStatement(
        `var u = 'possessive';
        var x = fbt(
          [
            'It is ',
            fbt.pronoun(u, gender),
            ' birthday.',
          ], 'throw not StringLiteral',
        );`,
      ),

    throws:
      '`usage`, the first argument of fbt.pronoun() must be a `StringLiteral` but we got `Identifier`',
  },

  'should throw on unknown options': {
    input: withFbtImportStatement(
      `var x = fbt(
        'There were ' + fbt.plural('a like', count, {whatisthis: 'huh?'}),
        'plurals',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'There were ',
          fbt.plural('a like', count, {whatisthis: 'huh?'}),
        ], 'plurals',
      );`,
    ),

    throws: `Invalid option "whatisthis". Only allowed: many, name, showCount, value, count`,
  },

  'should throw when a fbt.param is nested inside a fbt.name': {
    input: withFbtImportStatement(
      `var z = fbt(
        'a ' +
        fbt.name('name', fbt.param('paramName', val2), gender) +
        ' b',
        'desc',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var z = fbt(
        [
          'a ',
          fbt.name('name', fbt.param('paramName', val2), gender),
          ' b',
        ], 'desc',
      );`,
    ),

    throws:
      `Expected fbt constructs to not nest inside fbt constructs, ` +
      `but found fbt.param nest inside fbt.name`,
  },

  'should throw when a fbt.param is nested inside another fbt.param': {
    input: withFbtImportStatement(
      `var z = fbt(
        'a ' +
        fbt.param('name', fbt.param('name2', val2)) +
        ' b',
        'desc',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var z = fbt(
        [
          'a ',
          fbt.param('name', fbt.param('name2', val2)),
          ' b',
        ], 'desc',
      );`,
    ),

    throws:
      `Expected fbt constructs to not nest inside fbt constructs, ` +
      `but found fbt.param nest inside fbt.param`,
  },

  'should throw when a fbt.param is used outside of fbt': {
    input: withFbtImportStatement(`var z = fbt.param('name', val);`),

    throws:
      `Fbt constructs can only be used within the scope of an fbt` +
      ` string. I.e. It should be used directly inside an ` +
      `‹fbt› / ‹fbs› callsite`,
  },

  'should throw when concatenating an fbt construct to a string while using the array argument syntax':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `var x = fbt(
          [
            'It is ' + fbt.pronoun('possessive', gender) + ' birthday.'
          ], 'throw because fbt constructs should be used as array items only',
        );`,
      ),

      throws:
        'fbt(array) only supports items that are string literals, ' +
        'template literals without any expressions, or fbt constructs',
    },

  'should throw when multiple tokens have the same names due to implicit params':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `var z = fbt(
        [
          'Hello ',
          <a>world</a>,
          ' ',
          <a>world</a>,
        ], 'token name collision due to autoparam',
      );`,
      ),

      throws: `There's already a token called "=world" in this fbt call`,
    },

  'should throw when multiple tokens have the same names due to implicit params and an fbt.param':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `var z = fbt(
        [
          'Hello ',
          <a>world</a>,
          ' ',
          fbt.param('=world', value),
        ], 'token name collision due to autoparam',
      );`,
      ),

      throws: `There's already a token called "=world" in this fbt call`,
    },

  'should throw when multiple tokens have the same names due to implicit params and an fbt.plural':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `var z = fbt(
        [
          'Hello ',
          <a>world</a>,
          ' ',
          <b>
            {fbt.plural('world', value)}
          </b>,
        ], 'token name collision due to autoparam',
      );`,
      ),

      throws: `There's already a token called "=world" in this fbt call`,
    },

  'should throw when multiple tokens have the same names due to implicit params and fbt.enum':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `var z = fbt(
        [
          'Hello ',
          <a>world</a>,
          ' ',
          <a>{
            fbt.enum(value, ['world'])
          }</a>,
        ], 'token name collision due to autoparam',
      );`,
      ),

      throws: `There's already a token called "=world" in this fbt call`,
    },

  'should throw when two arguments have the same names': {
    input: withFbtImportStatement(
      `var z = fbt(
        'a ' +
        fbt.param('name', val1) +
        fbt.param('name', val2) +
        ' b',
        'desc',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var z = fbt(
        [
          'a ',
          fbt.param('name', val1),
          fbt.param('name', val2),
          ' b',
        ], 'desc',
      );`,
    ),

    throws: `There's already a token called "name" in this fbt call`,
  },
};

const filterTestCasesByType = (
  testCases: TestCases,
  type: 'input' | 'inputWithArraySyntax',
) => {
  const filteredTestCases: Record<string, TestCase> = {};
  for (const title of Object.keys(testCases)) {
    const testCase = testCases[title];
    if (!testCase[type]?.length) {
      continue;
    }

    const scenario = {
      ...testCase,
      input: testCase[type],
    };

    if (scenario.runWithTestFbtEnumManifest) {
      scenario.options = {
        fbtEnumManifest: scenario.runWithTestFbtEnumManifest,
      };
    }
    filteredTestCases[title] = scenario;
  }
  return filteredTestCases;
};

function withThrowExpectation(
  throwExpectation: boolean | string | undefined,
  callback: () => void,
) {
  return () => {
    if (throwExpectation === true) {
      expect(callback).toThrow();
    } else if (typeof throwExpectation === 'string') {
      expect(callback).toThrow(throwExpectation);
    } else {
      callback();
    }
  };
}

const describeTestScenarios = (testCases: TestCases) => {
  describe('Translation transform', () => {
    testSection(testCases, transform);
  });

  function forEachTestScenario(
    callback: (
      title: string,
      testCase: TestCase,
      options?: PluginOptions,
    ) => void,
  ) {
    for (const title of Object.keys(testCases)) {
      callback(title, testCases[title]);
    }
  }

  describe('Meta-data collection', () => {
    describe('should collect correct meta data', () => {
      forEachTestScenario((title: string, testCase: TestCase) => {
        test(
          `for scenario "${title}"`,
          withThrowExpectation(testCase.throws, () => {
            const pluginOptions = {
              collectFbt: true,
              fbtEnumManifest: testCase.runWithTestFbtEnumManifest,
              generateOuterTokenName: true,
            };
            transform(testCase.input, pluginOptions);
            expect(getExtractedStrings()).toMatchSnapshot();
          }),
        );
      });
    });

    describe('should create correct FbtNode objects', () => {
      forEachTestScenario((title: string, testCase: TestCase) => {
        test(
          `for scenario "${title}"`,
          withThrowExpectation(testCase.throws, () => {
            const spy = jest.spyOn(
              FbtFunctionCallProcessor.prototype,
              '_convertToFbtNode',
            );
            spy.mockClear();

            const pluginOptions = {
              collectFbt: true,
              fbtEnumManifest: testCase.runWithTestFbtEnumManifest,
              generateOuterTokenName: true,
            };
            transform(testCase.input, pluginOptions);

            expect(spy).toHaveBeenCalled();
            for (const result of spy.mock.results) {
              if (result.type === 'return') {
                expect(result.value).toMatchSnapshot();
              }
            }
          }),
        );
      });
    });
  });
};

describe('Functional FBT API', () => {
  describe('using string-concatenated arguments:', () => {
    describeTestScenarios(filterTestCasesByType(testCases, 'input'));
  });

  describe('using array arguments:', () => {
    describeTestScenarios(
      filterTestCasesByType(testCases, 'inputWithArraySyntax'),
    );
  });
});
