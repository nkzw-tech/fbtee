/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * @format
 * @oncall i18n_fbt_js
 */

import * as React from 'react';
import renderer from 'react-test-renderer';
import Example from '../Example.react';

describe('Example.react', () => {
  it('renders the example', () => {
    const example = renderer.create(<Example />).toJSON();
    expect(example).toMatchSnapshot();
  });
});
