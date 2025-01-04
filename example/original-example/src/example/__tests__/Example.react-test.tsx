import { render } from '@testing-library/react';
import Example from '../Example.react.tsx';

describe('Example.react', () => {
  it('renders the example', () => {
    const { asFragment } = render(<Example />);
    expect(asFragment()).toMatchSnapshot();
  });
});
