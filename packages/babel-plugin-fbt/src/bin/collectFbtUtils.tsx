import path from 'node:path';
import invariant from 'invariant';
import type { FbtOptionConfig } from '../FbtConstants';
import type { CollectFbtOutput } from './collectFbt';
import packagerTypes from './collectFbtConstants';
import type {
  CollectorConfig,
  IFbtCollector,
  PackagerPhrase,
} from './FbtCollector';
import FbtCollector from './FbtCollector';
import PhrasePackager from './PhrasePackager';
import type { HashFunction } from './TextPackager';
import TextPackager from './TextPackager';

export function buildCollectFbtOutput(
  fbtCollector: IFbtCollector,
  packagers: ReadonlyArray<
    | {
        pack: (phrases: Array<PackagerPhrase>) => Array<PackagerPhrase>;
      }
    | PhrasePackager
    | TextPackager
  >,
  options: {
    genFbtNodes: boolean;
  }
): CollectFbtOutput {
  return {
    childParentMappings: fbtCollector.getChildParentMappings(),
    fbtElementNodes: options.genFbtNodes
      ? fbtCollector.getFbtElementNodes()
      : // using `undefined` so that the field is not outputted by JSON.stringify
        undefined,
    phrases: packagers.reduce(
      (phrases, packager) => packager.pack(phrases),
      fbtCollector.getPhrases()
    ),
  };
}

async function getTextPackager(hashModulePath: string): Promise<TextPackager> {
  const hashingModule = (await import(hashModulePath)).default as
    | HashFunction
    | {
        getFbtHash: HashFunction;
      };

  invariant(
    typeof hashingModule === 'function' ||
      (typeof hashingModule === 'object' &&
        typeof hashingModule.getFbtHash === 'function'),
    'Expected hashing module to expose a default value that is a function, ' +
      'or an object with a getFbtHash() function property. Hashing module location: `%s`',
    hashModulePath
  );
  return new TextPackager(
    typeof hashingModule === 'function'
      ? hashingModule
      : hashingModule.getFbtHash
  );
}

export async function getPackagers(
  packager: string,
  hashModulePath: string
): Promise<
  ReadonlyArray<
    | {
        pack: (phrases: Array<PackagerPhrase>) => Array<PackagerPhrase>;
      }
    | PhrasePackager
    | TextPackager
  >
> {
  switch (packager) {
    case packagerTypes.TEXT:
      return [await getTextPackager(hashModulePath)];
    case packagerTypes.PHRASE:
      return [new PhrasePackager()];
    case packagerTypes.BOTH:
      return [await getTextPackager(hashModulePath), new PhrasePackager()];
    case packagerTypes.NONE:
      return [{ pack: (phrases) => phrases }];
    default:
      throw new Error('Unrecognized packager option');
  }
}

export async function getFbtCollector(
  collectorConfig: CollectorConfig,
  extraOptions: FbtOptionConfig,
  customCollectorPath?: string | null
): Promise<IFbtCollector> {
  if (customCollectorPath == null) {
    return new FbtCollector(collectorConfig, extraOptions);
  }
  const absPath = path.isAbsolute(customCollectorPath)
    ? customCollectorPath
    : path.resolve(process.cwd(), customCollectorPath);

  const CustomCollector = (await import(absPath)).default;
  return new CustomCollector(collectorConfig, extraOptions);
}
