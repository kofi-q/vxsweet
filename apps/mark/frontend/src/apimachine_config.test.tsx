import { electionFamousNames2021Fixtures } from '@vx/libs/fixtures/src';
import { ALL_PRECINCTS_SELECTION } from '@vx/libs/utils/src';
import { render, screen } from '../test/react_testing_library';
import { type ApiMock, createApiMock } from '../test/helpers/mock_api_client';
import { App } from './app';

let apiMock: ApiMock;

beforeEach(() => {
  jest.useFakeTimers();
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
  apiMock.expectGetElectionRecord(
    electionFamousNames2021Fixtures.electionDefinition
  );
  apiMock.expectGetElectionState({
    precinctSelection: ALL_PRECINCTS_SELECTION,
  });
  render(<App reload={jest.fn()} apiClient={apiMock.mockApiClient} />);
  apiMock.setAuthStatusPollWorkerLoggedIn(
    electionFamousNames2021Fixtures.electionDefinition
  );
  await screen.findByText('mock-code-version');
});
