jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: jest.fn(),
  };
});

jest.mock(
  '../../components/misvote_warnings/warning_details',
  (): typeof import('../../components/misvote_warnings/warning_details') => ({
    ...jest.requireActual('../../components/misvote_warnings/warning_details'),
    WarningDetails: jest.fn(),
  })
);
jest.mock(
  '../../components/misvote_warnings/misvote_warnings',
  (): typeof import('../../components/misvote_warnings/misvote_warnings') => ({
    ...jest.requireActual('../../components/misvote_warnings/misvote_warnings'),
    MisvoteWarnings: jest.fn(),
  })
);

import userEvent from '@testing-library/user-event';
import { electionGeneralDefinition } from '@vx/libs/fixtures/src';
import {
  AdjudicationReason,
  type CandidateContest,
  DEFAULT_SYSTEM_SETTINGS,
} from '@vx/libs/types/elections';
import { mockOf } from '@vx/libs/test-utils/src';
import { render, screen } from '../../test/react_testing_library';
import { ScanWarningScreen, type Props } from './scan_warning_screen';
import {
  type ApiMock,
  createApiMock,
  provideApi,
  statusNoPaper,
} from '../../test/helpers/mock_api_client';
import { WarningDetails as MisvoteWarningDetails } from '../../components/misvote_warnings/warning_details';
import { MisvoteWarnings } from '../../components/misvote_warnings/misvote_warnings';

let apiMock: ApiMock;

beforeEach(() => {
  apiMock = createApiMock();
  apiMock.expectGetMachineConfig();
  apiMock.expectGetConfig();
  apiMock.expectGetScannerStatus(statusNoPaper);

  mockOf(MisvoteWarnings).mockImplementation(() => (
    <div data-testid="mockMisvoteWarnings" />
  ));

  mockOf(MisvoteWarningDetails).mockImplementation(() => (
    <div data-testid="mockMisvoteWarningDetails" />
  ));
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
});

function renderScreen(props: Partial<Props> = {}) {
  return render(
    provideApi(
      apiMock,
      <ScanWarningScreen
        electionDefinition={electionGeneralDefinition}
        systemSettings={DEFAULT_SYSTEM_SETTINGS}
        adjudicationReasonInfo={[]}
        {...props}
      />
    )
  );
}

test('overvote', async () => {
  apiMock.mockApiClient.acceptBallot.expectCallWith().resolves();
  const contest = electionGeneralDefinition.election.contests.find(
    (c): c is CandidateContest => c.type === 'candidate'
  )!;

  renderScreen({
    adjudicationReasonInfo: [
      {
        type: AdjudicationReason.Overvote,
        contestId: contest.id,
        optionIds: contest.candidates.map(({ id }) => id),
        expected: 1,
      },
    ],
  });

  await screen.findByRole('heading', { name: 'Review Your Ballot' });
  screen.getByTestId('mockMisvoteWarnings');
  expect(mockOf(MisvoteWarnings)).toBeCalledWith(
    {
      blankContests: [],
      overvoteContests: [contest],
      partiallyVotedContests: [],
    },
    {}
  );

  userEvent.click(screen.getByRole('button', { name: 'Cast Ballot As Is' }));

  screen.getByTestId('mockMisvoteWarningDetails');
  expect(mockOf(MisvoteWarningDetails)).toBeCalledWith(
    {
      blankContests: [],
      overvoteContests: [contest],
      partiallyVotedContests: [],
    },
    {}
  );

  const confirmButton = screen.getByRole('button', {
    name: 'Yes, Cast Ballot As Is',
  });
  userEvent.click(confirmButton);
  expect(confirmButton).toBeDisabled();
});

test('overvote when casting overvotes is disallowed', async () => {
  apiMock.mockApiClient.returnBallot.expectCallWith().resolves();

  const contest = electionGeneralDefinition.election.contests.find(
    (c): c is CandidateContest => c.type === 'candidate'
  )!;

  renderScreen({
    adjudicationReasonInfo: [
      {
        type: AdjudicationReason.Overvote,
        contestId: contest.id,
        optionIds: contest.candidates.map(({ id }) => id),
        expected: 1,
      },
    ],
    systemSettings: {
      ...DEFAULT_SYSTEM_SETTINGS,
      precinctScanDisallowCastingOvervotes: true,
    },
  });

  await screen.findByRole('heading', { name: 'Review Your Ballot' });
  screen.getByTestId('mockMisvoteWarnings');
  expect(mockOf(MisvoteWarnings)).toBeCalledWith(
    {
      blankContests: [],
      overvoteContests: [contest],
      partiallyVotedContests: [],
    },
    {}
  );

  expect(
    screen.queryByRole('button', { name: 'Cast Ballot As Is' })
  ).not.toBeInTheDocument();

  userEvent.click(screen.getByRole('button', { name: 'Return Ballot' }));
});

test('blank ballot', async () => {
  apiMock.mockApiClient.acceptBallot.expectCallWith().resolves();
  renderScreen({
    adjudicationReasonInfo: [{ type: AdjudicationReason.BlankBallot }],
  });

  await screen.findByRole('heading', {
    name: 'Review Your Ballot',
  });
  screen.getByText('No votes were found when scanning this ballot.');
  userEvent.click(screen.getByRole('button', { name: 'Cast Ballot As Is' }));
  const confirmButton = screen.getByRole('button', {
    name: 'Yes, Cast Ballot As Is',
  });
  userEvent.click(confirmButton);
  expect(confirmButton).toBeDisabled();
});

test('undervote no votes', async () => {
  apiMock.mockApiClient.acceptBallot.expectCallWith().resolves();
  const contest = electionGeneralDefinition.election.contests.find(
    (c): c is CandidateContest => c.type === 'candidate'
  )!;

  renderScreen({
    adjudicationReasonInfo: [
      {
        type: AdjudicationReason.Undervote,
        contestId: contest.id,
        expected: 1,
        optionIds: [],
      },
    ],
  });

  await screen.findByRole('heading', { name: 'Review Your Ballot' });
  screen.getByTestId('mockMisvoteWarnings');
  expect(mockOf(MisvoteWarnings)).toBeCalledWith(
    {
      blankContests: [contest],
      overvoteContests: [],
      partiallyVotedContests: [],
    },
    {}
  );

  userEvent.click(screen.getByRole('button', { name: 'Cast Ballot As Is' }));

  screen.getByTestId('mockMisvoteWarningDetails');
  expect(mockOf(MisvoteWarningDetails)).toBeCalledWith(
    {
      blankContests: [contest],
      overvoteContests: [],
      partiallyVotedContests: [],
    },
    {}
  );

  const confirmButton = screen.getByRole('button', {
    name: 'Yes, Cast Ballot As Is',
  });
  userEvent.click(confirmButton);
  expect(confirmButton).toBeDisabled();
});

test('undervote by 1', async () => {
  apiMock.mockApiClient.acceptBallot.expectCallWith().resolves();
  const contest = electionGeneralDefinition.election.contests.find(
    (c): c is CandidateContest => c.type === 'candidate' && c.seats > 1
  )!;

  renderScreen({
    adjudicationReasonInfo: [
      {
        type: AdjudicationReason.Undervote,
        contestId: contest.id,
        expected: contest.seats,
        optionIds: contest.candidates
          .slice(0, contest.seats - 1)
          .map(({ id }) => id),
      },
    ],
  });

  await screen.findByRole('heading', { name: 'Review Your Ballot' });
  screen.getByTestId('mockMisvoteWarnings');
  expect(mockOf(MisvoteWarnings)).toBeCalledWith(
    {
      blankContests: [],
      overvoteContests: [],
      partiallyVotedContests: [contest],
    },
    {}
  );

  userEvent.click(screen.getByRole('button', { name: 'Cast Ballot As Is' }));

  screen.getByTestId('mockMisvoteWarningDetails');
  expect(mockOf(MisvoteWarningDetails)).toBeCalledWith(
    {
      blankContests: [],
      overvoteContests: [],
      partiallyVotedContests: [contest],
    },
    {}
  );

  userEvent.click(
    screen.getByRole('button', { name: 'Yes, Cast Ballot As Is' })
  );
});

test('multiple undervotes', async () => {
  apiMock.mockApiClient.acceptBallot.expectCallWith().resolves();
  const contests = electionGeneralDefinition.election.contests
    .filter((c) => c.type === 'candidate')
    .slice(0, 2);

  renderScreen({
    adjudicationReasonInfo: contests.map((contest) => ({
      type: AdjudicationReason.Undervote,
      contestId: contest.id,
      expected: contest.seats,
      optionIds: contest.candidates.slice(0, 1).map(({ id }) => id),
    })),
  });

  await screen.findByRole('heading', { name: 'Review Your Ballot' });
  screen.getByTestId('mockMisvoteWarnings');
  expect(mockOf(MisvoteWarnings)).toBeCalledWith(
    {
      blankContests: [],
      overvoteContests: [],
      partiallyVotedContests: contests,
    },
    {}
  );

  userEvent.click(screen.getByRole('button', { name: 'Cast Ballot As Is' }));
  screen.getByTestId('mockMisvoteWarningDetails');
  expect(mockOf(MisvoteWarningDetails)).toBeCalledWith(
    {
      blankContests: [],
      overvoteContests: [],
      partiallyVotedContests: contests,
    },
    {}
  );

  userEvent.click(
    screen.getByRole('button', { name: 'Yes, Cast Ballot As Is' })
  );
});
