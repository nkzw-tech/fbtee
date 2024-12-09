import { JSXOpeningElement } from '@babel/types';
import type { PlainFbtNode } from '../../fbt-nodes/FbtNode';
import { FbtNodeType } from '../../fbt-nodes/FbtNodeType';
import type { EnumManifest } from '../../FbtEnumRegistrar';
import type {
  ChildParentMappings,
  IFbtCollector,
  PackagerPhrase,
} from '../FbtCollector';

export default class CustomFbtCollector implements IFbtCollector {
  async collectFromOneFile(
    _source: string,
    _filename?: string | null,
    _fbtEnumManifest?: EnumManifest
  ): Promise<void> {}

  async collectFromFiles(
    _files: Array<[string, string]>,
    _fbtEnumManifest?: EnumManifest
  ): Promise<void> {
    throw new Error('Not implemented');
  }

  getPhrases(): Array<PackagerPhrase> {
    return [
      {
        col_beg: 8,
        col_end: 14,
        filepath: '',
        jsfbt: {
          m: [],
          t: {
            desc: 'description',
            text: 'Hello {=World}!',
            tokenAliases: {},
          },
        },
        line_beg: 3,
        line_end: 5,
        project: '',
      },
      {
        col_beg: 16,
        col_end: 38,
        filepath: '',
        jsfbt: {
          m: [],
          t: {
            desc: 'In the phrase: "Hello {=World}!"',
            text: 'World',
            tokenAliases: {},
            outerTokenName: '=World',
          },
        },
        line_beg: 4,
        line_end: 4,
        project: '',
      },
    ];
  }

  getChildParentMappings(): ChildParentMappings {
    return {
      // We need an object keyed by numbers only
      [1]: 0,
    };
  }

  getFbtElementNodes(): Array<PlainFbtNode> {
    const pseudoJSXOpeningElement: JSXOpeningElement = {
      type: 'JSXOpeningElement',
      selfClosing: false,
      name: { type: 'JSXIdentifier', name: 'fbt' },
      attributes: [],
    };
    return [
      {
        phraseIndex: 0,
        children: [
          {
            type: FbtNodeType.Text,
          },
          {
            phraseIndex: 1,
            children: [
              {
                type: FbtNodeType.Text,
              },
            ],
            type: FbtNodeType.ImplicitParam,
            wrapperNode: {
              type: 'a',
              babelNode: pseudoJSXOpeningElement,
              props: {
                className: 'neatoLink',
                href: 'https://somewhere.random',
                tabindex: 123,
              },
            },
          },
        ],
        type: FbtNodeType.Element,
      },
    ];
  }
}
