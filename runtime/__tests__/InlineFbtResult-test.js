import { cleanup, render, screen } from '@testing-library/react';

/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 */

jest.disableAutomock();

const InlineFbtResult = require('../InlineFbtResult');

const React = require('react');

afterEach(cleanup);

describe('InlineFbtResult', function () {
  it('behaves like a string and a React element', function () {
    const result = new InlineFbtResult(
      ['hippopotamus'],
      false,
      'hippopotamus',
      null
    );
    expect(React.isValidElement(result)).toBe(true);
    expect(result.toString()).toBe('hippopotamus');

    render(<div data-testid="test-result">{result}</div>);
    expect(screen.getByTestId('test-result')).toHaveTextContent('hippopotamus');
  });
});
