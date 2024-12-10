import { onEachLeaf } from '../JSFbtUtil';
import type { PatternHash, PatternString } from '../Types';
import type { HashToLeaf, PackagerPhrase } from './FbtCollector';

export type HashFunction = (
  text: PatternString,
  description: string
) => PatternHash;

/**
 * TextPackager massages the data to handle multiple texts in fbt payloads (like
 * enum branches) and hashes each individual text.  It stores this mapping in a
 * stripped down phrase
 */
export default class TextPackager {
  _hash: HashFunction;
  constructor(hash: HashFunction) {
    this._hash = hash;
  }

  pack(phrases: Array<PackagerPhrase>): Array<PackagerPhrase> {
    return phrases.map((phrase) => {
      const hashToLeaf: HashToLeaf = {};
      onEachLeaf(phrase, ({ desc, text }) => {
        hashToLeaf[this._hash(text, desc)] = {
          desc,
          text,
        };
      });

      return {
        hashToLeaf,
        ...(phrase as PackagerPhrase),
      };
    });
  }
}
