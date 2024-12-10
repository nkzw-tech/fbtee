import type { HashToLeaf } from '../bin/FbtCollector';
import type { FbtTableKey, PatternHash, PatternString } from '../Types';
import type {
  IntlFbtVariationTypeValue,
  IntlVariationMaskValue,
} from './IntlVariations';
import { FbtVariationType, Mask } from './IntlVariations';

export type FbtSiteHashToLeaf = FbtSiteHashToTextAndDesc | FbtSiteHashToText;

export type FbtSiteHashToTextAndDesc = HashToLeaf;

export type FbtSiteHashToText = Partial<Record<PatternHash, PatternString>>;

/**
 * Jsfbt table with leaves hashified.
 *
 * @example Single fbt plain string
 * 'hash_of_single_plain_string'
 *
 * @example Fbt string with multiple variations
 * {
 *   '*': {
 *     '*': 'hash_1',
 *     _1: 'hash_2',
 *   },
 * }
 */
export type FbtSiteHashifiedTableJSFBTTree =
  | PatternHash
  | { [K in FbtTableKey]: FbtSiteHashifiedTableJSFBTTree };

/**
 * Represents a fbt() or <fbt /> source data from a callsite and all
 * the information necessary to produce the translated payload.  It is
 * used primarily by TranslationBuilder for this process.
 *
 * FbtSiteBase defines the necessary methods required by TranslationBuilder to build
 * translated payload. Implementation of these methods could vary between different
 * types of FbtSiteBase depending on the structure of source data they represent.
 */
export class FbtSiteBase<
  MetaDataEntry extends FbtSiteMetaEntryBase,
  HashToLeaf extends FbtSiteHashToLeaf
> {
  readonly hashToLeaf: HashToLeaf;
  readonly project: string;
  readonly table: FbtSiteHashifiedTableJSFBTTree;
  readonly metadata: ReadonlyArray<MetaDataEntry | null | undefined>;

  constructor(
    hashToLeaf: HashToLeaf,
    table: FbtSiteHashifiedTableJSFBTTree,
    metadata: ReadonlyArray<MetaDataEntry | null | undefined>,
    project: string
  ) {
    this.hashToLeaf = hashToLeaf;
    this.table = table;
    this.metadata = metadata;
    this.project = project;
  }

  getProject(): string {
    return this.project;
  }

  getHashToLeaf(): HashToLeaf {
    return this.hashToLeaf;
  }

  /**
   * For a string with variations, this looks something like:
   *
   * {
   *   "*": {
   *     ... { "*": <HASH> }
   *   }
   * }
   * For a string without variation, this is simply the HASH
   */
  getTableOrHash(): FbtSiteHashifiedTableJSFBTTree {
    return this.table;
  }

  getMetadata(): ReadonlyArray<MetaDataEntry | null | undefined> {
    return this.metadata;
  }
}

/**
 * Represents a metadata entry in a <fbt> source data. An entry could result
 * in string variations during the translation process depending on the
 * locale we are translating the string for.
 */
export class FbtSiteMetaEntryBase {
  readonly type: IntlFbtVariationTypeValue | null | undefined;
  readonly token: string | null | undefined;

  constructor(type?: IntlFbtVariationTypeValue | null, token?: string | null) {
    this.type = type;
    this.token = token;
  }

  getToken(): string | null | undefined {
    return this.token;
  }

  hasVariationMask(): boolean {
    throw new Error('This method must be implemented in a child class');
  }

  getVariationMask(): IntlVariationMaskValue | null | undefined {
    throw new Error('This method must be implemented in a child class');
  }
}

export function getVariationMaskFromType(
  type?: IntlFbtVariationTypeValue | null
): IntlVariationMaskValue | null | undefined {
  switch (type) {
    case FbtVariationType.GENDER:
      return Mask.GENDER;
    case FbtVariationType.NUMBER:
      return Mask.NUMBER;
  }
  return null;
}
