jest.mock('../jams/remove_jammed_sheet_screen');

import { mockOf } from '@vx/libs/test-utils/src';
import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';
import {
  createApiMock,
  type ApiMock,
} from '../../test/helpers/mock_api_client';
import { render, screen } from '../../test/react_testing_library';
import { PaperReloadedPage } from './paper_reloaded_page';
import { RemoveJammedSheetScreen } from '../jams/remove_jammed_sheet_screen';

let apiMock: ApiMock;
beforeEach(() => {
  apiMock = createApiMock();
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
});

beforeEach(() => {
  mockOf(RemoveJammedSheetScreen).mockImplementation(() => (
    <div>mockRemoveJammedSheetScreen</div>
  ));
});

test('redirects to /ready-to-review if session already in progress', () => {
  const mockHistory = createMemoryHistory({ initialEntries: ['/contest/0'] });

  render(
    <Router history={mockHistory}>
      <PaperReloadedPage votesSelected />
    </Router>
  );

  screen.getByText('Remove Poll Worker Card');
  expect(mockHistory.location.pathname).toEqual('/ready-to-review');
});

test("no URL change if voting session hasn't started", () => {
  const mockHistory = createMemoryHistory({ initialEntries: ['/contest/0'] });

  render(
    <Router history={mockHistory}>
      <PaperReloadedPage votesSelected={false} />
    </Router>
  );

  screen.getByText('Remove Poll Worker Card');
  expect(mockHistory.location.pathname).toEqual('/');
});
