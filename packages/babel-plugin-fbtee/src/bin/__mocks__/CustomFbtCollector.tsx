import { JSXOpeningElement } from '@babel/types';
import type { PlainFbtNode } from '../../fbt-nodes/FbtNode.tsx';
import type { EnumManifest } from '../../FbtEnumRegistrar.tsx';
import type {
  ChildParentMappings,
  IFbtCollector,
  PackagerPhrase,
} from '../FbtCollector.tsx';

export default class CustomFbtCollector implements IFbtCollector {
  async collectFromOneFile(
    _source: string,
    _filename?: string | null,
    _fbtEnumManifest?: EnumManifest,
  ): Promise<void> {}

  async collectFromFiles(
    _files: Array<[string, string]>,
    _fbtEnumManifest?: EnumManifest,
  ): Promise<void> {
    throw new Error('Not implemented');
  }

  getPhrases(): Array<PackagerPhrase> {
    return [
      {
        filename: '',
        jsfbt: {
          m: [],
          t: {
            desc: 'description',
            text: 'Hello {=World}!',
            tokenAliases: {},
          },
        },
        loc: {
          end: {
            column: 14,
            line: 5,
          },
          start: {
            column: 8,
            line: 3,
          },
        },
        project: '',
      },
      {
        filename: '',
        jsfbt: {
          m: [],
          t: {
            desc: 'In the phrase: "Hello {=World}!"',
            outerTokenName: '=World',
            text: 'World',
            tokenAliases: {},
          },
        },
        loc: {
          end: {
            column: 38,
            line: 4,
          },
          start: {
            column: 16,
            line: 4,
          },
        },
        project: '',
      },
    ];
  }

  getChildParentMappings(): ChildParentMappings {
    return new Map([[1, 0]]);
  }

  getFbtElementNodes(): Array<PlainFbtNode> {
    const pseudoJSXOpeningElement: JSXOpeningElement = {
      attributes: [],
      name: { name: 'fbt', type: 'JSXIdentifier' },
      selfClosing: false,
      type: 'JSXOpeningElement',
    };
    return [
      {
        children: [
          {
            type: 'text',
          },
          {
            children: [
              {
                type: 'text',
              },
            ],
            phraseIndex: 1,
            type: 'implicitParam',
            wrapperNode: {
              node: pseudoJSXOpeningElement,
              props: {
                className: 'neatoLink',
                href: 'https://somewhere.random',
                tabindex: 123,
              },
              type: 'a',
            },
          },
        ],
        phraseIndex: 0,
        type: 'element',
      },
    ];
  }
}
