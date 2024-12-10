import { describe, expect, it } from '@jest/globals';
import { FbtSite } from '../FbtSite.tsx';

describe('FbtSite: testing fromScan', () => {
  let fbtSite: FbtSite;

  beforeEach(() => {
    fbtSite = FbtSite.fromScan({
      col_beg: 10,
      col_end: 20,
      filepath: 'Example.react.js',
      hashToLeaf: {
        'PqPPir8Kg9xSlqdednPFOg==': {
          desc: 'example 1',
          text: '{name} has shared {=a photo} with you',
        },
        'gVKMc/8jq5vnYR5v2bb32g==': {
          desc: 'example 1',
          text: '{name} has shared {=[number] photos} with you',
        },
      },
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
              tokenAliases: {
                '=[number] photos': '=m2',
              },
            },
            _1: {
              desc: 'example 1',
              text: '{name} has shared {=a photo} with you',
              tokenAliases: {
                '=a photo': '=m2',
              },
            },
          },
        },
      },
      line_beg: 9,
      line_end: 10,
      project: 'fbt-demo-project',
    });
  });

  it('should compute hashToTokenAliases property as expected', () => {
    expect(fbtSite.getHashToTokenAliases()).toEqual({
      'PqPPir8Kg9xSlqdednPFOg==': {
        '=a photo': '=m2',
      },
      'gVKMc/8jq5vnYR5v2bb32g==': {
        '=[number] photos': '=m2',
      },
    });
  });

  it('should compute hashifiedTableJSFBTTree property as expected', () => {
    expect(fbtSite.getTableOrHash()).toEqual({
      '*': {
        '*': 'gVKMc/8jq5vnYR5v2bb32g==',
        _1: 'PqPPir8Kg9xSlqdednPFOg==',
      },
    });
  });
});
