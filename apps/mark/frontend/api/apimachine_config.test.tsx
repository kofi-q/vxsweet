import * as electionFamousNames from '@vx/libs/fixtures/src/data/electionFamousNames2021/election.json';
import { ALL_PRECINCTS_SELECTION } from '@vx/libs/utils/src';
import { render, screen } from '../test/react_testing_library';
import { type ApiMock, createApiMock } from '../test/helpers/mock_api_client';
import { App } from '../app/app';

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
  apiMock.expectGetElectionRecord(electionFamousNames.toElectionDefinition());
  apiMock.expectGetElectionState({
    precinctSelection: ALL_PRECINCTS_SELECTION,
  });
  render(<App reload={jest.fn()} apiClient={apiMock.mockApiClient} />);
  apiMock.setAuthStatusPollWorkerLoggedIn(
    electionFamousNames.toElectionDefinition()
  );
  await screen.findByText('mock-code-version');
});
