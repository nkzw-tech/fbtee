import fbtHashKey from '../fbtHashKey.tsx';
import jenkinsHash from '../fbtJenkinsHash.tsx';
import type { PackagerPhrase } from './FbtCollector.tsx';

/**
 * PhrasePackager differs from TextPackager in that it hashes the
 * entire payload for identification
 */
export default class PhrasePackager {
  pack(phrases: Array<PackagerPhrase>): Array<PackagerPhrase> {
    return phrases.map((phrase) => {
      return {
        hash_code: jenkinsHash(phrase.jsfbt.t),
        hash_key: fbtHashKey(phrase.jsfbt.t),
        ...(phrase as PackagerPhrase),
      };
    });
  }
}
