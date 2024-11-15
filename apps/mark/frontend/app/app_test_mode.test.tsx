import userEvent from '@testing-library/user-event';
import { election as electionGeneral } from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { ALL_PRECINCTS_SELECTION } from '@vx/libs/utils/src';
import { DateWithoutTime } from '@vx/libs/basics/time';
import { render, screen, waitFor } from '../test/react_testing_library';

import { type ApiMock, createApiMock } from '../test/helpers/mock_api_client';
import { App } from './app';
import { asElectionDefinition } from '@vx/libs/fixtures/src';

let apiMock: ApiMock;

beforeEach(() => {
  jest.useFakeTimers();
  apiMock = createApiMock();
  apiMock.expectGetSystemSettings();
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
});

it('Prompts to change from test mode to live mode on election day', async () => {
  const electionDefinition = asElectionDefinition({
    ...electionGeneral,
    date: DateWithoutTime.today(),
  });

  apiMock.expectGetMachineConfig();
  apiMock.expectGetElectionRecord(electionDefinition);
  apiMock.expectGetElectionState({
    isTestMode: true,
    precinctSelection: ALL_PRECINCTS_SELECTION,
  });
  render(<App apiClient={apiMock.mockApiClient} />);

  await screen.findByText('Test Ballot Mode');
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition);
  await screen.findByText(
    'Switch to Official Ballot Mode and reset the Ballots Printed count?'
  );
  apiMock.expectSetTestMode(false);
  apiMock.expectGetElectionState({
    isTestMode: false,
  });
  userEvent.click(
    screen.getByRole('button', { name: 'Switch to Official Ballot Mode' })
  );
  await waitFor(() =>
    expect(screen.queryByText('Test Ballot Mode')).toBeNull()
  );
});
