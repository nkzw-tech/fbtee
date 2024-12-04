/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @flow
 * @noformat
 */

/* eslint max-len: ["warn", 120] */

'use strict';

import type { BabelPluginList, BabelPresetList } from '@babel/core';
import type { PatternHash, PatternString } from '../../../../runtime/FbtTable';
import type { PlainFbtNode } from '../fbt-nodes/FbtNode';
import type { FbtExtraOptionConfig } from '../FbtConstants';
import type { EnumManifest } from '../FbtEnumRegistrar';
import type { BabelPluginFbt, Phrase, PluginOptions } from '../index';

const FbtUtil = require('../FbtUtil');
const fbt = require('../index');
const fs = require('fs');

export type ExternalTransform = (
  src: string,
  opts: TransformOptions,
  filename: ?string
) => mixed;
export type CollectorConfig = {|
  fbtCommonPath?: string,
  plugins?: BabelPluginList,
  presets?: BabelPresetList,
  transform?: ?ExternalTransform,
  generateOuterTokenName?: boolean,
|};
type ParentPhraseIndex = number;
export type ChildParentMappings = {
  [childPhraseIndex: number]: ParentPhraseIndex,
};
export type HashToLeaf = {
  [hash: PatternHash]: {|
    desc: string,
    text: PatternString,
  |},
};
export type PackagerPhrase = {|
  ...Phrase,
  hash_code?: number,
  hash_key?: string,
  hashToLeaf?: HashToLeaf,
|};
export type TransformOptions = $ReadOnly<{|
  ...PluginOptions,
  fbtModule: BabelPluginFbt,
|}>;

export interface IFbtCollector {
  constructor(
    config: CollectorConfig,
    extraOptions: FbtExtraOptionConfig
  ): void;
  collectFromOneFile(
    source: string,
    filename: ?string,
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

class FbtCollector implements IFbtCollector {
  _phrases: Array<PackagerPhrase>;
  _childParentMappings: ChildParentMappings;
  _extraOptions: FbtExtraOptionConfig;
  _config: CollectorConfig;

  constructor(config: CollectorConfig, extraOptions: FbtExtraOptionConfig) {
    this._phrases = [];
    this._childParentMappings = {};
    this._extraOptions = extraOptions;
    this._config = config;
  }

  collectFromOneFile(
    source: string,
    filename: ?string,
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
    };

    if (!FbtUtil.textContainsFbtLikeModule(source)) {
      return;
    }

    const externalTransform = this._config.transform;
    if (externalTransform) {
      // $FlowFixMe[incompatible-exact]
      externalTransform(source, options, filename);
    } else {
      const transform = require('@fbtjs/default-collection-transform');
      transform(
        source,
        // $FlowFixMe[incompatible-exact]
        options,
        this._config.plugins || [],
        this._config.presets || []
      );
    }

    let newPhrases = fbt.getExtractedStrings();
    const newChildParentMappings = fbt.getChildToParentRelationships();
    const offset = this._phrases.length;
    Object.entries(newChildParentMappings).forEach(
      ([childIndex, parentIndex]) => {
        this._childParentMappings[offset + +childIndex] = offset + parentIndex;
      }
    );

    // PackagerPhrase is an extended type of Phrase
    // $FlowExpectedError[prop-missing] ignore missing hashToLeaf issue
    this._phrases.push(...(newPhrases: Array<PackagerPhrase>));
  }

  collectFromFiles(
    files: Array<[string, string]>,
    fbtEnumManifest?: EnumManifest
  ) {
    files.forEach(([file, source]) => {
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

module.exports = FbtCollector;
