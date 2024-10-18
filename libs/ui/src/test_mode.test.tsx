import { render, screen } from '../test/react_testing_library';

import { TestMode } from './test_mode';

test('renders TestMode - VVSG styling', () => {
  render(<TestMode />, {
    vxTheme: { sizeMode: 'touchLarge' },
  });
  screen.getByText('Test Ballot Mode');
});
