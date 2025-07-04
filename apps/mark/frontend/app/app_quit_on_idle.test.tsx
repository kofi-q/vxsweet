import { ALL_PRECINCTS_SELECTION } from '@vx/libs/utils/src';

import userEvent from '@testing-library/user-event';
import { createMocks as createReactIdleTimerMocks } from 'react-idle-timer';
import {
  IDLE_RESET_TIMEOUT_SECONDS,
  IDLE_TIMEOUT_SECONDS,
} from '@vx/libs/mark-flow-ui/src';
import { type BallotStyleId } from '@vx/libs/types/elections';
import { render, screen, waitFor } from '../test/react_testing_library';
import { App } from './app';
import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
const electionGeneralDefinition = electionGeneral.toElectionDefinition();

import { advanceTimersAndPromises } from '../test/helpers/timers';

import { type ApiMock, createApiMock } from '../test/helpers/mock_api_client';

let apiMock: ApiMock;

jest.useFakeTimers();
beforeEach(() => {
  createReactIdleTimerMocks();
  apiMock = createApiMock();
  apiMock.expectGetSystemSettings();
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
});

test('Voter idle timeout', async () => {
  apiMock.expectGetMachineConfig();
  apiMock.expectGetElectionRecord(electionGeneralDefinition);
  apiMock.expectGetElectionState({
    precinctSelection: ALL_PRECINCTS_SELECTION,
    pollsState: 'polls_open',
  });

  render(<App apiClient={apiMock.mockApiClient} />);

  // Start voter session
  apiMock.setAuthStatusCardlessVoterLoggedIn({
    ballotStyleId: '12' as BallotStyleId,
    precinctId: '23',
  });

  // Let idle timeout kick in and acknowledge
  userEvent.click(await screen.findByText('Start Voting'));
  await advanceTimersAndPromises(IDLE_TIMEOUT_SECONDS);
  screen.getByText('Are you still voting?');
  userEvent.click(
    screen.getByRole('button', { name: 'Yes, I’m still voting.' })
  );
  await waitFor(() =>
    expect(screen.queryByText('Are you still voting?')).toBeNull()
  );

  // Let idle timeout kick in and don't acknowledge
  await advanceTimersAndPromises(IDLE_TIMEOUT_SECONDS);
  screen.getByText('Are you still voting?');
  apiMock.mockApiClient.endCardlessVoterSession.expectCallWith().resolves();
  await advanceTimersAndPromises(IDLE_RESET_TIMEOUT_SECONDS);
  await screen.findByText('Clearing ballot');
  apiMock.setAuthStatusLoggedOut();
  await screen.findByText('Insert Card');
});
