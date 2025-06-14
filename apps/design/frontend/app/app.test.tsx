import { suppressingConsoleOutput } from '@vx/libs/test-utils/src';
import userEvent from '@testing-library/user-event';
import { type ElectionId } from '@vx/libs/types/elections';
import { type MockApiClient, createMockApiClient } from '../test/api_helpers';
import { render, screen } from '../test/react_testing_library';
import { App } from './app';

let apiMock: MockApiClient;

beforeEach(() => {
  apiMock = createMockApiClient();
});

afterEach(() => {
  apiMock.assertComplete();
});

test('API errors show an error screen', async () => {
  await suppressingConsoleOutput(async () => {
    apiMock.listElections.expectCallWith().resolves([]);
    render(<App apiClient={apiMock} />);

    await screen.findByRole('heading', { name: 'Elections' });

    apiMock.createElection
      .expectCallWith({ id: 'test-random-id-1' as ElectionId })
      .throws(new Error('API error'));
    userEvent.click(screen.getByRole('button', { name: 'Create Election' }));

    await screen.findByText('Something went wrong');
    const appLink = screen.getByRole('link', { name: 'VxDesign' });
    expect(appLink).toHaveAttribute('href', '/');
  });
});
