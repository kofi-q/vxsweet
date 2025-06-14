jest.mock('./qrcode', () => ({
  ...jest.requireActual('./qrcode'),
  QrCode: () => <span>QR code</span>,
}));

jest.mock('../ui_strings/ui_string/ui_string', () => ({
  ...jest.requireActual('../ui_strings/ui_string/ui_string'),
  UiString: jest.fn(),
}));

import {
  type CandidateContest,
  type Election,
  type ElectionDefinition,
  type VotesDict,
  type YesNoContest,
  getContests,
} from '@vx/libs/types/elections';
import { LanguageCode } from '@vx/libs/types/languages';
import { ElectionStringKey } from '@vx/libs/types/ui_strings';
import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
const electionGeneralDefinition = electionGeneral.toElectionDefinition();

import { mockOf } from '@vx/libs/test-utils/src';
import { generateBallotStyleId } from '@vx/libs/utils/src';
import { assertDefined } from '@vx/libs/basics/assert';
import { find } from '@vx/libs/basics/collections';
import { BmdPaperBallot } from './bmd_paper_ballot';
import { newTestContext as newUiStringsTestContext } from '../test/test_context';
import {
  UiString,
  type UiStringProps,
} from '../ui_strings/ui_string/ui_string';
import { useLanguageContext } from '../ui_strings/language_context/language_context';
import { act, screen, waitFor } from '../test/react_testing_library';
import { type AppStringKey } from '../ui_strings/ui_string/app_strings';
import {
  generateCandidateVotes,
  generateYesNoVote,
} from './bmd_paper_ballot_test_utils';

const mockUiStringRenderer = mockOf(UiString);

const baseElection = electionGeneralDefinition.election;

const ballotLanguages = [LanguageCode.ENGLISH, LanguageCode.SPANISH];
const election: Election = {
  ...baseElection,
  ballotStyles: baseElection.ballotStyles.flatMap((ballotStyle, i) =>
    ballotLanguages.map((languageCode) => ({
      ...ballotStyle,
      id: generateBallotStyleId({
        ballotStyleIndex: i + 1,
        languages: [languageCode],
      }),
      languages: [languageCode],
    }))
  ),
  seal: '<svg />',
};

const electionDefinition: ElectionDefinition = {
  ...electionGeneralDefinition,
  election,
};

type UiStringKey = ElectionStringKey | AppStringKey;

interface MockUiStringOutput {
  key: UiStringKey;
  languageCode: string;
  subKey?: string;
}

function getMockUiStringPrefix(languageCode: string) {
  return `~${languageCode}~`;
}

function generateMockUiString(params: MockUiStringOutput) {
  const { key, languageCode, subKey } = params;
  const subKeyString = subKey ? `.${subKey}` : '';

  return `${getMockUiStringPrefix(languageCode)} ${key}${subKeyString}`;
}

function expectDualLanguageString(
  params: Omit<MockUiStringOutput, 'languageCode'>
) {
  screen.getByText(
    generateMockUiString({ ...params, languageCode: LanguageCode.SPANISH })
  );
  screen.getByText(
    generateMockUiString({ ...params, languageCode: LanguageCode.ENGLISH })
  );
}

function expectSingleLanguageString(params: MockUiStringOutput) {
  screen.getByText(generateMockUiString(params));

  const otherLanguage =
    params.languageCode === LanguageCode.SPANISH
      ? LanguageCode.ENGLISH
      : LanguageCode.SPANISH;

  expect(
    screen.queryByText(
      generateMockUiString({ ...params, languageCode: otherLanguage })
    )
  ).not.toBeInTheDocument();
}

const { getLanguageContext, mockApiClient, render } = newUiStringsTestContext();

beforeEach(() => {
  mockApiClient.getAvailableLanguages.mockResolvedValueOnce(ballotLanguages);
  mockApiClient.getUiStrings.mockResolvedValue(null);

  mockUiStringRenderer.mockImplementation((props: UiStringProps) => {
    const { uiStringKey, uiStringSubKey } = props;
    const { currentLanguageCode } = assertDefined(useLanguageContext());

    return (
      <span data-testid={uiStringKey}>
        {generateMockUiString({
          key: uiStringKey as AppStringKey | ElectionStringKey,
          languageCode: currentLanguageCode,
          subKey: uiStringSubKey,
        })}
      </span>
    );
  });
});

describe('non-English ballot style', () => {
  const spanishBallotStyle = find(
    election.ballotStyles,
    (b) => b.languages?.[0] === LanguageCode.SPANISH
  );

  const contests = getContests({ ballotStyle: spanishBallotStyle, election });

  test('ballot header', async () => {
    render(
      <BmdPaperBallot
        ballotStyleId={spanishBallotStyle.id}
        electionDefinition={electionDefinition}
        isLiveMode
        precinctId={spanishBallotStyle.precincts[0]}
        votes={{}}
        onRendered={() => {}}
        machineType="markScan"
      />
    );

    await waitFor(() =>
      expect(getLanguageContext()?.currentLanguageCode).toEqual(
        LanguageCode.ENGLISH
      )
    );

    expectDualLanguageString({ key: 'titleOfficialBallot' });
    expectDualLanguageString({ key: ElectionStringKey.ELECTION_TITLE });
    expectDualLanguageString({ key: ElectionStringKey.ELECTION_DATE });
    expectSingleLanguageString({
      key: ElectionStringKey.COUNTY_NAME,
      languageCode: LanguageCode.SPANISH,
    });
    expectSingleLanguageString({
      key: ElectionStringKey.STATE_NAME,
      languageCode: LanguageCode.SPANISH,
    });
  });

  test('candidate contest', async () => {
    const contest: CandidateContest = {
      ...find(contests, (c): c is CandidateContest => c.type === 'candidate'),
      seats: 3,
    };
    const candidate = find(contest.candidates, (c) => !!c.partyIds?.[0]);

    render(
      <BmdPaperBallot
        ballotStyleId={spanishBallotStyle.id}
        electionDefinition={{
          ...electionDefinition,
          election: { ...election, contests: [contest] },
        }}
        isLiveMode
        precinctId={spanishBallotStyle.precincts[0]}
        votes={{
          [contest.id]: [
            candidate,
            { id: 'write-in', name: 'PRINCESS FIONA', isWriteIn: true },
          ],
        }}
        onRendered={() => {}}
        machineType="markScan"
      />
    );

    await waitFor(() =>
      expect(getLanguageContext()?.currentLanguageCode).toEqual(
        LanguageCode.ENGLISH
      )
    );

    expectDualLanguageString({
      key: ElectionStringKey.CONTEST_TITLE,
      subKey: contest.id,
    });

    expectSingleLanguageString({
      key: ElectionStringKey.CANDIDATE_NAME,
      languageCode: LanguageCode.ENGLISH,
      subKey: candidate.id,
    });

    for (const partyId of candidate.partyIds!) {
      expectSingleLanguageString({
        key: ElectionStringKey.PARTY_NAME,
        languageCode: LanguageCode.SPANISH,
        subKey: partyId,
      });
    }

    screen.getByText('PRINCESS FIONA');
    expectDualLanguageString({ key: 'labelWriteInParenthesized' });

    expectDualLanguageString({ key: 'labelNumVotesUnused' });
  });

  test('candidate contest no votes', async () => {
    const contest: CandidateContest = find(
      contests,
      (c): c is CandidateContest => c.type === 'candidate'
    );

    render(
      <BmdPaperBallot
        ballotStyleId={spanishBallotStyle.id}
        electionDefinition={{
          ...electionDefinition,
          election: { ...election, contests: [contest] },
        }}
        isLiveMode
        precinctId={spanishBallotStyle.precincts[0]}
        votes={{}}
        onRendered={() => {}}
        machineType="markScan"
      />
    );

    await waitFor(() =>
      expect(getLanguageContext()?.currentLanguageCode).toEqual(
        LanguageCode.ENGLISH
      )
    );

    expectDualLanguageString({ key: 'noteBallotContestNoSelection' });
  });

  test('yes/no contest', async () => {
    const contest = find(
      contests,
      (c): c is YesNoContest => c.type === 'yesno'
    );
    render(
      <BmdPaperBallot
        ballotStyleId={spanishBallotStyle.id}
        electionDefinition={{
          ...electionDefinition,
          election: { ...election, contests: [contest] },
        }}
        isLiveMode
        precinctId={spanishBallotStyle.precincts[0]}
        votes={{ [contest.id]: [contest.yesOption.id] }}
        onRendered={() => {}}
        machineType="markScan"
      />
    );

    await waitFor(() =>
      expect(getLanguageContext()?.currentLanguageCode).toEqual(
        LanguageCode.ENGLISH
      )
    );

    expectDualLanguageString({
      key: ElectionStringKey.CONTEST_TITLE,
      subKey: contest.id,
    });

    expectDualLanguageString({
      key: ElectionStringKey.CONTEST_OPTION_LABEL,
      subKey: contest.yesOption.id,
    });
  });

  test('yes/no contest undervote', async () => {
    const contest = find(
      contests,
      (c): c is YesNoContest => c.type === 'yesno'
    );

    render(
      <BmdPaperBallot
        ballotStyleId={spanishBallotStyle.id}
        electionDefinition={{
          ...electionDefinition,
          election: { ...election, contests: [contest] },
        }}
        isLiveMode
        precinctId={spanishBallotStyle.precincts[0]}
        votes={{}}
        onRendered={() => {}}
        machineType="markScan"
      />
    );

    await waitFor(() =>
      expect(getLanguageContext()?.currentLanguageCode).toEqual(
        LanguageCode.ENGLISH
      )
    );

    expectDualLanguageString({
      key: ElectionStringKey.CONTEST_TITLE,
      subKey: contest.id,
    });

    expectDualLanguageString({ key: 'noteBallotContestNoSelection' });
  });
});

describe('English ballot style', () => {
  const englishBallotStyle = find(
    election.ballotStyles,
    (b) => b.languages?.[0] === LanguageCode.ENGLISH
  );

  const contests = getContests({ ballotStyle: englishBallotStyle, election });

  test('all votes filled in', async () => {
    const votes: VotesDict = Object.fromEntries(
      contests.map((c) => [
        c.id,
        c.type === 'yesno' ? generateYesNoVote(c) : generateCandidateVotes(c),
      ])
    );

    const { container } = render(
      <BmdPaperBallot
        ballotStyleId={englishBallotStyle.id}
        electionDefinition={electionDefinition}
        isLiveMode
        precinctId={englishBallotStyle.precincts[0]}
        votes={votes}
        onRendered={() => {}}
        machineType="markScan"
      />
    );

    await waitFor(() => expect(getLanguageContext()).toBeDefined());

    // Change app-wide language to Spanish to verify ballot language is not
    // affected:
    act(() => getLanguageContext()!.setLanguage(LanguageCode.SPANISH));
    await waitFor(() =>
      expect(getLanguageContext()?.currentLanguageCode).toEqual(
        LanguageCode.SPANISH
      )
    );

    expect(container).not.toHaveTextContent(
      new RegExp(getMockUiStringPrefix(LanguageCode.SPANISH))
    );
  });

  test('no votes', async () => {
    const { container } = render(
      <BmdPaperBallot
        ballotStyleId={englishBallotStyle.id}
        electionDefinition={electionDefinition}
        isLiveMode
        precinctId={englishBallotStyle.precincts[0]}
        votes={{}}
        onRendered={() => {}}
        machineType="markScan"
      />
    );

    await waitFor(() =>
      expect(getLanguageContext()?.currentLanguageCode).toEqual(
        LanguageCode.ENGLISH
      )
    );

    expect(container).not.toHaveTextContent(
      new RegExp(getMockUiStringPrefix(LanguageCode.SPANISH))
    );
  });
});
