import { render, screen } from '../test/react_testing_library';

import { HorizontalRule } from './horizontal_rule';

describe('Renders HorizontalRule', () => {
  test('with defaults', () => {
    render(<HorizontalRule>or</HorizontalRule>);
    screen.getByText('or');
  });

  test('without children', () => {
    const { container } = render(<HorizontalRule />);
    expect(container.firstChild).toEqual(
      container.getElementsByTagName('p').item(0)
    );
  });
});
