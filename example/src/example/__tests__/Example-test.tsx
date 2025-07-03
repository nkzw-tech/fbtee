import { render } from '@testing-library/react';
import Example from '../Example.tsx';

describe('Example.react', () => {
  it('renders the example', () => {
    const { asFragment } = render(<Example />);
    expect(asFragment()).toMatchSnapshot();
  });
});
