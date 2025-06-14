jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
  };
});

jest.mock('../preprinted-ballots/inserted_invalid_new_sheet_screen');

jest.mock('../preprinted-ballots/inserted_preprinted_ballot_screen');

jest.mock('../ready-for-review/ballot_ready_for_review_screen');

jest.mock(
  '../ballot-reinsertion/ballot_reinsertion_flow',
  (): typeof import('../ballot-reinsertion/ballot_reinsertion_flow') => ({
    ...jest.requireActual('../ballot-reinsertion/ballot_reinsertion_flow'),
    BallotReinsertionFlow: () => <div>MockBallotReinsertionFlow</div>,
  })
);

import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import {
  type ElectionDefinition,
  formatElectionHashes,
  InsertedSmartCardAuth,
} from '@vx/libs/types/elections';
import { LanguageCode } from '@vx/libs/types/languages';
const electionGeneralDefinition = electionGeneral.toElectionDefinition();

import {
  BooleanEnvironmentVariableName,
  generateBallotStyleId,
  getFeatureFlagMock,
  singlePrecinctSelectionFor,
} from '@vx/libs/utils/src';
import {
  advancePromises,
  hasTextAcrossElements,
  mockOf,
} from '@vx/libs/test-utils/src';
import userEvent from '@testing-library/user-event';

import { assertDefined } from '@vx/libs/basics/assert';
import { DateWithoutTime } from '@vx/libs/basics/time';
import { type SimpleServerStatus } from '../../../backend/custom-paper-handler/types';
import { fireEvent, screen } from '../../test/react_testing_library';

import { render } from '../../test/test_utils';

import {
  PollWorkerScreen,
  type PollworkerScreenProps,
} from './poll_worker_screen';
import { mockMachineConfig } from '../../test/helpers/mock_machine_config';
import {
  type ApiMock,
  createApiMock,
} from '../../test/helpers/mock_api_client';
import {
  mockCardlessVoterAuth,
  mockPollWorkerAuth,
} from '../../test/helpers/mock_auth';
import { ApiProvider } from '../../api/api_provider';
import { InsertedInvalidNewSheetScreen } from '../preprinted-ballots/inserted_invalid_new_sheet_screen';
import { InsertedPreprintedBallotScreen } from '../preprinted-ballots/inserted_preprinted_ballot_screen';
import { BallotReadyForReviewScreen } from '../ready-for-review/ballot_ready_for_review_screen';
import { BALLOT_REINSERTION_SCREENS } from '../ballot-reinsertion/ballot_reinsertion_flow';
import { asElectionDefinition } from '@vx/libs/fixtures/src';

const { election } = electionGeneralDefinition;

let apiMock: ApiMock;
const mockFeatureFlagger = getFeatureFlagMock();

const MOCK_BALLOT_REINSERTION_FLOW_CONTENT = 'MockBallotReinsertionFlow';

beforeEach(() => {
  jest.useFakeTimers();
  apiMock = createApiMock();

  mockFeatureFlagger.resetFeatureFlags();
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.MARK_SCAN_DISABLE_BALLOT_REINSERTION
  );
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
});

function renderScreen(
  props: Partial<PollworkerScreenProps> = {},
  pollWorkerAuth: InsertedSmartCardAuth.PollWorkerLoggedIn = mockPollWorkerAuth(
    electionGeneralDefinition
  ),
  electionDefinition: ElectionDefinition = electionGeneralDefinition
) {
  return render(
    <ApiProvider apiClient={apiMock.mockApiClient}>
      <PollWorkerScreen
        pollWorkerAuth={pollWorkerAuth}
        activateCardlessVoterSession={jest.fn()}
        electionDefinition={electionDefinition}
        electionPackageHash="test-election-package-hash"
        hasVotes={false}
        isLiveMode={false}
        pollsState="polls_open"
        ballotsPrintedCount={0}
        machineConfig={mockMachineConfig()}
        precinctSelection={singlePrecinctSelectionFor(
          electionDefinition.election.precincts[0].id
        )}
        setVotes={jest.fn()}
        {...props}
      />
    </ApiProvider>
  );
}

test('renders PollWorkerScreen', () => {
  renderScreen();
  screen.getByText('Poll Worker Actions');
  expect(
    screen.getByText('Ballots Printed:').parentElement!.textContent
  ).toEqual('Ballots Printed: 0');
});

test('switching out of test mode on election day', () => {
  const electionDefinition = asElectionDefinition({
    ...election,
    date: DateWithoutTime.today(),
  });
  apiMock.expectSetTestMode(false);
  renderScreen({
    pollWorkerAuth: mockPollWorkerAuth(electionDefinition),
    electionDefinition,
  });

  screen.getByText(
    'Switch to Official Ballot Mode and reset the Ballots Printed count?'
  );
  userEvent.click(screen.getByText('Switch to Official Ballot Mode'));
});

test('keeping test mode on election day', () => {
  const electionDefinition = asElectionDefinition({
    ...election,
    date: DateWithoutTime.today(),
  });
  renderScreen({ electionDefinition });

  screen.getByText(
    'Switch to Official Ballot Mode and reset the Ballots Printed count?'
  );
  fireEvent.click(screen.getByText('Cancel'));
});

test('live mode on election day', () => {
  renderScreen({ isLiveMode: true });
  expect(
    screen.queryByText(
      'Switch to Official Ballot Mode and reset the Ballots Printed count?'
    )
  ).toBeNull();
});

test('can toggle between vote activation and "other actions" during polls open', async () => {
  renderScreen({
    pollsState: 'polls_open',
    machineConfig: mockMachineConfig(),
  });

  // confirm we start with polls open
  await screen.findByText(hasTextAcrossElements('Select Voter’s Ballot Style'));

  // switch to other actions pane
  userEvent.click(screen.getByText('View More Actions'));
  screen.getByRole('heading', { name: /poll worker actions/i });

  // switch back
  userEvent.click(screen.getByText('Back to Ballot Style Selection'));
  screen.getByText('Select Voter’s Ballot Style');
});

test('returns instruction page if status is `waiting_for_ballot_data`', async () => {
  const electionDefinition = electionGeneralDefinition;
  const pollWorkerAuth = mockCardlessVoterAuth(electionDefinition);
  apiMock.setPaperHandlerState('waiting_for_ballot_data');

  renderScreen({
    pollsState: 'polls_open',
    pollWorkerAuth,
    machineConfig: mockMachineConfig(),
    electionDefinition,
  });

  await screen.findByText('Remove Card to Begin Voting Session');
});

test('returns null if status is unhandled', () => {
  const electionDefinition = electionGeneralDefinition;
  const pollWorkerAuth = mockCardlessVoterAuth(electionDefinition);
  apiMock.setPaperHandlerState('scanning');

  renderScreen({
    pollsState: 'polls_open',
    pollWorkerAuth,
    machineConfig: mockMachineConfig(),
    electionDefinition,
  });

  expect(screen.queryByText('Paper has been loaded.')).toBeNull();
  expect(screen.queryByText('Poll Worker Actions')).toBeNull();
});

test('displays only default English ballot styles', async () => {
  const baseElection = electionGeneralDefinition.election;

  const ballotLanguages = [LanguageCode.ENGLISH, LanguageCode.SPANISH];
  const [ballotStyleEnglish, ballotStyleSpanish] = ballotLanguages.map((l) => ({
    ...baseElection.ballotStyles[0],
    id: generateBallotStyleId({ ballotStyleIndex: 1, languages: [l] }),
    languages: [l],
  }));

  const electionDefinition: ElectionDefinition = {
    ...electionGeneralDefinition,
    election: {
      ...baseElection,
      ballotStyles: [ballotStyleEnglish, ballotStyleSpanish],
    },
  };
  renderScreen({
    pollsState: 'polls_open',
    machineConfig: mockMachineConfig(),
    pollWorkerAuth: mockPollWorkerAuth(electionDefinition),
    electionDefinition,
  });

  await screen.findByText(hasTextAcrossElements('Select Voter’s Ballot Style'));

  screen.getButton(ballotStyleEnglish.groupId);
  expect(
    screen.queryByRole('button', { name: ballotStyleSpanish.id })
  ).not.toBeInTheDocument();
});
describe('pre-printed ballots', () => {
  test('start new session with blank sheet', () => {
    mockFeatureFlagger.disableFeatureFlag(
      BooleanEnvironmentVariableName.MARK_SCAN_DISABLE_BALLOT_REINSERTION
    );

    renderScreen({ electionDefinition: electionGeneralDefinition });

    const ballotStyle = assertDefined(
      electionGeneralDefinition.election.ballotStyles[0]
    );
    apiMock.expectSetAcceptingPaperState(['BlankPage', 'InterpretedBmdPage']);

    userEvent.click(screen.getButton(ballotStyle.groupId));
  });

  test('can insert pre-printed ballots without ballot style selection', () => {
    mockFeatureFlagger.disableFeatureFlag(
      BooleanEnvironmentVariableName.MARK_SCAN_DISABLE_BALLOT_REINSERTION
    );

    renderScreen();

    apiMock.expectSetAcceptingPaperState(['InterpretedBmdPage']);
    userEvent.click(screen.getButton(/insert printed ballot/i));
  });

  test('new section not rendered when re-insertion is disabled', () => {
    mockFeatureFlagger.enableFeatureFlag(
      BooleanEnvironmentVariableName.MARK_SCAN_DISABLE_BALLOT_REINSERTION
    );

    renderScreen();

    expect(
      screen.queryButton(/insert printed ballot/i)
    ).not.toBeInTheDocument();
  });

  const preprintedBallotInsertionStateContents: Partial<
    Record<SimpleServerStatus, string | RegExp>
  > = {
    accepting_paper: /feed one sheet of paper/i,
    loading_paper: /feed one sheet of paper/i,
    loading_new_sheet: /loading sheet/i,
    validating_new_sheet: /loading sheet/i,
    inserted_invalid_new_sheet: 'MockInvalidNewSheetScreen',
    inserted_preprinted_ballot: 'MockValidPreprintedBallotScreen',
    presenting_ballot: 'MockReadyForReviewScreen',
  };

  for (const [stateMachineState, expectedContents] of Object.entries(
    preprintedBallotInsertionStateContents
  ) as Array<[SimpleServerStatus, string | RegExp]>) {
    test(`state machine state: ${stateMachineState}`, async () => {
      mockOf(InsertedInvalidNewSheetScreen).mockReturnValue(
        <p>MockInvalidNewSheetScreen</p>
      );
      mockOf(InsertedPreprintedBallotScreen).mockReturnValue(
        <p>MockValidPreprintedBallotScreen</p>
      );
      mockOf(BallotReadyForReviewScreen).mockReturnValue(
        <p>MockReadyForReviewScreen</p>
      );

      apiMock.setPaperHandlerState(stateMachineState);

      renderScreen();

      await screen.findByText(expectedContents);
    });
  }
});

describe('shows BallotReinsertionFlow for relevant states:', () => {
  for (const state of Object.keys(BALLOT_REINSERTION_SCREENS)) {
    test(state, async () => {
      apiMock.setPaperHandlerState(state as SimpleServerStatus);

      const { container } = renderScreen();
      await advancePromises();

      expect(container).toHaveTextContent(MOCK_BALLOT_REINSERTION_FLOW_CONTENT);
    });
  }
});

test('Shows election info', () => {
  renderScreen();
  screen.getByText(election.title);
  screen.getByText(
    formatElectionHashes(
      electionGeneralDefinition.ballotHash,
      'test-election-package-hash'
    )
  );
});
