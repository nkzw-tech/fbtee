import fbtHashKey from '../fbtHashKey';
import jenkinsHash from '../fbtJenkinsHash';
import type { PackagerPhrase } from './FbtCollector';

/**
 * PhrasePackager differs from TextPackager in that it hashes the
 * entire payload for identification
 */
export default class PhrasePackager {
  pack(phrases: Array<PackagerPhrase>): Array<PackagerPhrase> {
    return phrases.map((phrase) => {
      return {
        hash_key: fbtHashKey(phrase.jsfbt.t),
        hash_code: jenkinsHash(phrase.jsfbt.t),
        ...(phrase as PackagerPhrase),
      };
    });
  }
}
