import { ALL_PRECINCTS_SELECTION } from '@vx/libs/utils/src';
import { advanceTimersAndPromises } from '@vx/libs/test-utils/src';
import { electionFamousNames2021Fixtures } from '@vx/libs/fixtures/src';
import { render, screen } from '../test/react_testing_library';
import { type ApiMock, createApiMock } from '../test/helpers/mock_api_client';
import { App } from '../app/app';

let apiMock: ApiMock;

beforeEach(() => {
  jest.useFakeTimers();
  window.location.href = '/';
  apiMock = createApiMock();
  apiMock.expectGetSystemSettings();
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
});

test('machineConfig is fetched from api client by default', async () => {
  apiMock.expectGetMachineConfig({
    codeVersion: 'mock-code-version',
  });
  const { electionDefinition } = electionFamousNames2021Fixtures;
  apiMock.expectGetElectionRecord(electionDefinition);
  apiMock.expectGetElectionState({
    precinctSelection: ALL_PRECINCTS_SELECTION,
  });
  render(<App apiClient={apiMock.mockApiClient} />);
  await advanceTimersAndPromises();
  apiMock.setAuthStatusPollWorkerLoggedIn(
    electionFamousNames2021Fixtures.electionDefinition
  );
  await advanceTimersAndPromises();
  await screen.findByText('mock-code-version');
});
