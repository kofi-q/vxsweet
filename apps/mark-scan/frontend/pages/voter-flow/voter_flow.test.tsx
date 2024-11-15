jest.mock(
  '@vx/libs/ui/accessible_controllers',
  (): typeof import('@vx/libs/ui/accessible_controllers') => ({
    ...jest.requireActual('@vx/libs/ui/accessible_controllers'),
    MarkScanControllerSandbox: jest.fn(),
    useAccessibleControllerHelpTrigger: () => {
      const [shouldShowControllerSandbox, setShouldShowControllerSandbox] =
        React.useState(false);
      setMockControllerHelpTriggered = setShouldShowControllerSandbox;

      return { shouldShowControllerSandbox };
    },
  })
);

jest.mock('./ballot', (): typeof import('./ballot') => ({
  ...jest.requireActual('./ballot'),
  Ballot: jest.fn(),
}));

jest.mock('../pat_device_identification/pat_device_calibration_page');

jest.mock('../../api/api', (): typeof import('../../api/api') => ({
  ...jest.requireActual('../../api/api'),
  confirmSessionEnd: { useMutation: jest.fn() },
}));

jest.mock(
  '../ballot-reinsertion/invalid_ballot',
  (): typeof import('../ballot-reinsertion/invalid_ballot') => ({
    ...jest.requireActual('../ballot-reinsertion/invalid_ballot'),
    ReinsertedInvalidBallotScreen: () => (
      <div>{MOCK_INVALID_BALLOT_SCREEN_CONTENTS}</div>
    ),
  })
);

jest.mock(
  '../ballot-reinsertion/waiting',
  (): typeof import('../ballot-reinsertion/waiting') => ({
    ...jest.requireActual('../ballot-reinsertion/waiting'),
    WaitingForBallotReinsertionBallotScreen: () => (
      <div>{MOCK_WAITING_FOR_REINSERTION_SCREEN_CONTENTS}</div>
    ),
  })
);

import { mockOf } from '@vx/libs/test-utils/src';
import {
  MarkScanControllerSandbox,
  useIsPatDeviceConnected,
} from '@vx/libs/ui/accessible_controllers';
import React from 'react';
import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { type SimpleServerStatus } from '../../../backend/custom-paper-handler/types';
import { act, render, screen } from '../../test/react_testing_library';
import { VoterFlow, type VoterFlowProps } from './voter_flow';
import { mockMachineConfig } from '../../test/helpers/mock_machine_config';
import { Ballot } from './ballot';
import { PatDeviceCalibrationPage } from '../pat_device_identification/pat_device_calibration_page';
import { createApiMock } from '../../test/helpers/mock_api_client';
import { ApiProvider } from '../../api/api_provider';
const electionGeneralDefinition = electionGeneral.toElectionDefinition();

let setMockControllerHelpTriggered:
  | ((shouldShowHelp: boolean) => void)
  | undefined;

const MOCK_INVALID_BALLOT_SCREEN_CONTENTS = 'MockInvalidBallotScreen';

const MOCK_WAITING_FOR_REINSERTION_SCREEN_CONTENTS =
  'MockWaitingForReinsertionScreen';

const mockApi = createApiMock();

function TestContext(props: React.PropsWithChildren) {
  const { children } = props;

  return (
    <ApiProvider apiClient={mockApi.mockApiClient}>{children}</ApiProvider>
  );
}

const electionDefinition = electionGeneralDefinition;
const { contests } = electionDefinition.election;

const TEST_VOTER_FLOW_PROPS: VoterFlowProps = {
  contests,
  electionDefinition,
  endVoterSession: jest.fn(),
  isLiveMode: true,
  machineConfig: mockMachineConfig(),
  resetBallot: jest.fn(),
  stateMachineState: 'waiting_for_ballot_data',
  updateVote: jest.fn(),
  votes: {},
};

beforeEach(() => {
  mockApi.mockApiClient.getIsPatDeviceConnected.mockReturnValue(false);
});

test('replaces screen with accessible controller sandbox when triggered', () => {
  mockOf(Ballot).mockReturnValue(<div data-testid="mockBallotScreen" />);
  mockOf(MarkScanControllerSandbox).mockReturnValue(
    <div data-testid="mockControllerSandbox" />
  );

  render(
    <TestContext>
      <VoterFlow {...TEST_VOTER_FLOW_PROPS} />
    </TestContext>
  );

  screen.getByTestId('mockBallotScreen');
  expect(screen.queryByTestId('mockControllerSandbox')).not.toBeInTheDocument();

  act(() => setMockControllerHelpTriggered!(true));
  screen.getByTestId('mockControllerSandbox');
  expect(screen.queryByTestId('mockBallotScreen')).not.toBeInTheDocument();
});

test('replaces screen with PAT device calibration when connected', () => {
  mockOf(Ballot).mockReturnValue(<div data-testid="mockBallotScreen" />);
  mockOf(PatDeviceCalibrationPage).mockReturnValue(
    <div data-testid="mockPatCalibrationScreen" />
  );

  const { rerender } = render(
    <TestContext>
      <VoterFlow {...TEST_VOTER_FLOW_PROPS} />
    </TestContext>
  );

  screen.getByTestId('mockBallotScreen');
  expect(
    screen.queryByTestId('mockPatCalibrationScreen')
  ).not.toBeInTheDocument();

  // Re-render with `pat_device_connected` state machine state:
  rerender(
    <TestContext>
      <VoterFlow
        {...{
          ...TEST_VOTER_FLOW_PROPS,
          stateMachineState: 'pat_device_connected', //
        }}
      />
    </TestContext>
  );
  screen.getByTestId('mockPatCalibrationScreen');
  expect(screen.queryByTestId('mockBallotScreen')).not.toBeInTheDocument();
});

test('sets up the PatDeviceContextProvider', async () => {
  mockApi.mockApiClient.getIsPatDeviceConnected.mockReturnValue(true);

  mockOf(Ballot).mockImplementation(() => {
    const isPatDeviceConnected = useIsPatDeviceConnected();

    return <div>PAT Device Connected: {isPatDeviceConnected.toString()}</div>;
  });

  render(
    <TestContext>
      <VoterFlow {...TEST_VOTER_FLOW_PROPS} />
    </TestContext>
  );

  await screen.findByText('PAT Device Connected: true');
});

describe('ballot removal/re-insertion', () => {
  const ballotReinsertionStateScreenContents: Partial<
    Record<SimpleServerStatus, string | RegExp>
  > = {
    waiting_for_ballot_reinsertion:
      MOCK_WAITING_FOR_REINSERTION_SCREEN_CONTENTS,
    loading_reinserted_ballot: /loading your ballot/i,
    validating_reinserted_ballot: /loading your ballot/i,
    reinserted_invalid_ballot: MOCK_INVALID_BALLOT_SCREEN_CONTENTS,
  };

  for (const [stateMachineState, expectedString] of Object.entries(
    ballotReinsertionStateScreenContents
  ) as Array<[SimpleServerStatus, string | RegExp]>) {
    test(`ballot re-insertion state: ${stateMachineState}`, async () => {
      render(
        <TestContext>
          <VoterFlow
            {...{
              ...TEST_VOTER_FLOW_PROPS,
              stateMachineState,
            }}
          />
        </TestContext>
      );

      await screen.findByText(expectedString);
    });
  }
});
