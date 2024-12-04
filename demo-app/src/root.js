/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @noflow
 */

import './css/root.css';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import Example from './example/Example.react';
import 'normalize.css';

const root = document.getElementById('root');

if (root == null) {
  throw new Error(`No root element found.`);
}

ReactDOM.render(<Example />, root);
