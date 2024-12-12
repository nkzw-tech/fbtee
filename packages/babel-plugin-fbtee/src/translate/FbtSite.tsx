import invariant from 'invariant';
import type { CollectFbtOutputPhrase } from '../bin/collect.tsx';
import type {
  JSFBTMetaEntry,
  TableJSFBTTree,
  TableJSFBTTreeBranch,
  TokenAliases,
} from '../index.tsx';
import { isTableJSFBTTreeLeaf, onEachLeaf } from '../JSFbtUtil.tsx';
import nullthrows from '../nullthrows.tsx';
import type { PatternHash, PatternString } from '../Types.tsx';
import type {
  FbtSiteHashifiedTableJSFBTTree,
  FbtSiteHashToTextAndDesc,
} from './FbtSiteBase.tsx';
import {
  FbtSiteBase,
  FbtSiteMetaEntryBase,
  getVariationMaskFromType,
} from './FbtSiteBase.tsx';
import type {
  IntlFbtVariationTypeValue,
  IntlVariationMaskValue,
} from './IntlVariations.tsx';
import { FbtVariationType } from './IntlVariations.tsx';

type TextAndDescConcatenation = string;

type TextAndDescToHash = Partial<Record<TextAndDescConcatenation, PatternHash>>;

type FbtSiteHashToTokenAliases = Partial<
  Record<PatternHash, TokenAliases | null | undefined>
>;

/**
 * Represents an <fbt>'s data source in the format of `SourceDataJSON`.
 *
 * E.g
 * {
 *  hashToLeaf: {
 *    hash: {text: '', desc: ''},
 *    ...
 *  },
 *  jsfbt: {
 *    t: {
 *      '*': {
 *        text: '',
 *        desc: '',
 *        tokenAliases: {...}
 *      },
 *      ....
 *    },
 *    m: [levelMetadata,...],
 *  }
 * }
 */
export class FbtSite extends FbtSiteBase<
  FbtSiteMetaEntry,
  FbtSiteHashToTextAndDesc
> {
  readonly _hashToTokenAliases: FbtSiteHashToTokenAliases;

  constructor(
    hashToTextAndDesc: FbtSiteHashToTextAndDesc,
    tableData: {
      m: ReadonlyArray<JSFBTMetaEntry | null | undefined>;
      t: FbtSiteHashifiedTableJSFBTTree;
    },
    project: string,
    hashToTokenAliases: FbtSiteHashToTokenAliases
  ) {
    super(
      hashToTextAndDesc,
      tableData.t,
      FbtSiteMetadata.wrap(tableData.m),
      project
    );
    this._hashToTokenAliases = hashToTokenAliases;
  }

  getHashToTokenAliases(): FbtSiteHashToTokenAliases {
    return this._hashToTokenAliases;
  }

  static fromScan(json: CollectFbtOutputPhrase): FbtSite {
    const textAndDescToHash: TextAndDescToHash = {};
    const { hashToLeaf, jsfbt } = json;
    invariant(hashToLeaf != null, 'Expected hashToLeaf to be defined');
    invariant(jsfbt != null, 'Expect a non-void jsfbt table');
    for (const hash of Object.keys(hashToLeaf)) {
      const node = hashToLeaf[hash]!;
      const textAndDesc = this._serializeTextAndDesc(node.text, node.desc);
      invariant(
        textAndDescToHash[textAndDesc] == null,
        "Duplicate text+desc pairs pointing to different hashes shouldn't be possible"
      );
      textAndDescToHash[textAndDesc] = hash;
    }
    const tableData = {
      m: jsfbt.m,
      t: FbtSite._hashifyLeaves(jsfbt.t, textAndDescToHash),
    } as const;
    const hashToTokenAliases: FbtSiteHashToTokenAliases = {};
    onEachLeaf({ jsfbt }, (leaf) => {
      const hash =
        textAndDescToHash[this._serializeTextAndDesc(leaf.text, leaf.desc)];
      if (hash && leaf.tokenAliases != null) {
        hashToTokenAliases[hash] = leaf.tokenAliases;
      }
    });

    return new FbtSite(hashToLeaf, tableData, json.project, hashToTokenAliases);
  }

  static _hashifyLeaves(
    entry: Readonly<TableJSFBTTree>,
    textAndDescToHash: Readonly<TextAndDescToHash>
  ): FbtSiteHashifiedTableJSFBTTree {
    if (isTableJSFBTTreeLeaf(entry)) {
      return textAndDescToHash[
        this._serializeTextAndDesc(entry.text, entry.desc)
      ] as FbtSiteHashifiedTableJSFBTTree;
    }

    const tree: FbtSiteHashifiedTableJSFBTTree = {};
    for (const key of Object.keys(entry)) {
      tree[key] = FbtSite._hashifyLeaves(
        entry[key as keyof typeof entry] as TableJSFBTTreeBranch,
        textAndDescToHash
      );
    }
    return tree;
  }

  /**
   * Strings with different hashes might have the same text, so we need to use
   * description to uniquely identify a string.
   * For example, in
   *  <fbt>
   *   <fbt:pronoun gender={$ex->getGender()} type="subject" human={true} />
   *   has shared <a href={link}>a photo</a>.
   *  </fbt>
   * `<a href={link}>a photo</a>` generates multiple strings with the same text:
   * {text: 'a photo', desc: 'In the phrase: She has shared {a photo}.'}
   * {text: 'a photo', desc: 'In the phrase: He has shared {a photo}.'}
   * ....
   */
  static _serializeTextAndDesc(
    text: PatternString,
    desc: string
  ): TextAndDescConcatenation {
    return JSON.stringify({ desc, text });
  }
}

export class FbtSiteMetaEntry extends FbtSiteMetaEntryBase {
  readonly _range: ReadonlyArray<string> | null | undefined;

  constructor(
    type?: IntlFbtVariationTypeValue | null,
    token?: string | null,
    range?: ReadonlyArray<string> | null
  ) {
    super(type, token);
    this._range = range;
  }

  override hasVariationMask(): boolean {
    return getVariationMaskFromType(this.type) != null;
  }

  override getVariationMask(): IntlVariationMaskValue {
    invariant(
      this.hasVariationMask(),
      'check hasVariationMask to avoid this invariant'
    );
    return nullthrows(getVariationMaskFromType(this.type));
  }

  static wrap(entry: Readonly<JSFBTMetaEntry>): FbtSiteMetaEntry {
    FbtSiteMetaEntry._validate(entry);
    return new this(
      entry.type || null,
      entry.token != null ? entry.token : null,
      entry.range || null
    );
  }

  unwrap(): JSFBTMetaEntry {
    const { token, type } = this;

    if (type === FbtVariationType.NUMBER) {
      return {
        token: token != null ? token : undefined,
        type: FbtVariationType.NUMBER,
      };
    }

    if (type === FbtVariationType.GENDER) {
      invariant(
        token != null,
        'token should be specified for gender variation'
      );
      return { token, type: FbtVariationType.GENDER };
    }

    if (type === FbtVariationType.PRONOUN) {
      return { type: FbtVariationType.PRONOUN };
    }

    invariant(
      this._range != null,
      'range should be specified for enum variation'
    );
    return { range: this._range };
  }

  static _validate(entry: Readonly<JSFBTMetaEntry>) {
    const type = entry.type || null;
    const token = entry.token != null ? entry.token : null;
    const range = entry.range || null;
    if (type === null) {
      invariant(
        range !== null,
        'if no type is provided, this must be enum variation and thus range must be specified '
      );
    } else {
      if (type === FbtVariationType.GENDER) {
        invariant(
          token !== null,
          'token should be specified for gender variation'
        );
      } else if (type === FbtVariationType.PRONOUN) {
        invariant(
          token === null,
          'token should not be specified for pronoun variation'
        );
      }
    }
  }
}

const FbtSiteMetadata = {
  unwrap(
    metaEntries: ReadonlyArray<FbtSiteMetaEntry | null | undefined>
  ): Array<JSFBTMetaEntry | null | undefined> {
    return metaEntries.map((entry) => (entry == null ? null : entry.unwrap()));
  },

  wrap(
    rawEntries: ReadonlyArray<JSFBTMetaEntry | null | undefined>
  ): Array<FbtSiteMetaEntry | null | undefined> {
    return rawEntries.map((entry) => entry && FbtSiteMetaEntry.wrap(entry));
  },
} as const;
