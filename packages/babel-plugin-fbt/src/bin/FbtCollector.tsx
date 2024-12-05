import type { PluginItem } from '@babel/core';
import type { PatternHash, PatternString } from '../../../fbt/src/FbtTable';
import type { PlainFbtNode } from '../fbt-nodes/FbtNode';
import type { FbtOptionConfig } from '../FbtConstants';
import type { EnumManifest } from '../FbtEnumRegistrar';
import { textContainsFbtLikeModule } from '../FbtUtil';
import type { Phrase, PluginOptions } from '../index';
import fbt from '../index';

export type ExternalTransform = (
  src: string,
  opts: TransformOptions,
  filename?: string | null | undefined
) => unknown;
export type CollectorConfig = {
  fbtCommonPath?: string;
  plugins?: ReadonlyArray<PluginItem>;
  presets?: ReadonlyArray<PluginItem>;
  transform?: ExternalTransform | null | undefined;
  generateOuterTokenName?: boolean;
};
type ParentPhraseIndex = number;
export type ChildParentMappings = {
  [childPhraseIndex: number]: ParentPhraseIndex;
};
export type HashToLeaf = Partial<
  Record<
    PatternHash,
    {
      desc: string;
      text: PatternString;
    }
  >
>;
export type PackagerPhrase = Phrase & {
  hash_code?: number;
  hash_key?: string;
  hashToLeaf?: HashToLeaf;
};
export type TransformOptions = Readonly<
  PluginOptions & {
    fbtModule: typeof fbt;
  }
>;

export interface IFbtCollector {
  collectFromOneFile(
    source: string,
    filename?: string | null | undefined,
    fbtEnumManifest?: EnumManifest
  ): void;
  collectFromFiles(
    files: Array<[string, string]>,
    fbtEnumManifest?: EnumManifest
  ): void;
  getChildParentMappings(): ChildParentMappings;
  getFbtElementNodes(): Array<PlainFbtNode>;
  getPhrases(): Array<PackagerPhrase>;
}

export default class FbtCollector implements IFbtCollector {
  _phrases: Array<PackagerPhrase>;
  _childParentMappings: ChildParentMappings;
  _extraOptions: FbtOptionConfig;
  _config: CollectorConfig;

  constructor(config: CollectorConfig, extraOptions: FbtOptionConfig) {
    this._phrases = [];
    this._childParentMappings = {};
    this._extraOptions = extraOptions;
    this._config = config;
  }

  collectFromOneFile(
    source: string,
    filename?: string | null,
    fbtEnumManifest?: EnumManifest
  ): void {
    const options = {
      collectFbt: true,
      extraOptions: this._extraOptions,
      fbtCommonPath: this._config.fbtCommonPath,
      fbtEnumManifest,
      fbtModule: fbt,
      filename,
      generateOuterTokenName: this._config.generateOuterTokenName,
    } as const;

    if (!textContainsFbtLikeModule(source)) {
      return;
    }

    const externalTransform = this._config.transform;
    if (externalTransform) {
      externalTransform(source, options, filename);
    } else {
      const transform = require('@fbtjs/default-collection-transform');
      transform(
        source,
        options,
        this._config.plugins || [],
        this._config.presets || []
      );
    }

    let newPhrases = fbt.getExtractedStrings();
    const newChildParentMappings = fbt.getChildToParentRelationships();
    const offset = this._phrases.length;
    Object.entries(newChildParentMappings).forEach(
      ([childIndex, parentIndex]: [any, any]) => {
        this._childParentMappings[offset + +childIndex] = offset + parentIndex;
      }
    );

    // PackagerPhrase is an extended type of Phrase
    this._phrases.push(...(newPhrases as Array<PackagerPhrase>));
  }

  collectFromFiles(
    files: Array<[string, string]>,
    fbtEnumManifest?: EnumManifest
  ) {
    files.forEach(([file, source]: [any, any]) => {
      this.collectFromOneFile(source, file, fbtEnumManifest);
    });
  }

  getPhrases(): Array<PackagerPhrase> {
    return this._phrases;
  }

  getChildParentMappings(): ChildParentMappings {
    return this._childParentMappings;
  }

  getFbtElementNodes(): Array<PlainFbtNode> {
    return fbt.getFbtElementNodes();
  }
}
