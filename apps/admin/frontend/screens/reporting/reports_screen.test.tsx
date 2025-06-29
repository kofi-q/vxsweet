import * as electionTwoPartyPrimary from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary/election.json';
import { hasTextAcrossElements } from '@vx/libs/test-utils/src';
import { type ElectionDefinition } from '@vx/libs/types/elections';
import { ReportsScreen } from './reports_screen';
import { renderInAppContext } from '../../test/render_in_app_context';
import {
  type ApiMock,
  createApiMock,
} from '../../test/helpers/mock_api_client';
import { screen } from '../../test/react_testing_library';
const electionTwoPartyPrimaryDefinition =
  electionTwoPartyPrimary.toElectionDefinition();

let apiMock: ApiMock;

jest.useFakeTimers();

beforeEach(() => {
  jest.setSystemTime(new Date('2020-11-03T22:22:00'));
  apiMock = createApiMock();
});

afterEach(() => {
  apiMock.assertComplete();
});

const electionDefinition = electionTwoPartyPrimaryDefinition;

describe('ballot count summary text', () => {
  test('unlocked mode', async () => {
    apiMock.expectGetCastVoteRecordFileMode('unlocked');
    apiMock.expectGetTotalBallotCount(0);

    renderInAppContext(<ReportsScreen />, {
      electionDefinition,
      apiMock,
    });

    await screen.findByText(hasTextAcrossElements('Ballot Count: 0'));
  });

  test('official mode', async () => {
    apiMock.expectGetCastVoteRecordFileMode('official');
    apiMock.expectGetTotalBallotCount(3000);

    renderInAppContext(<ReportsScreen />, {
      electionDefinition,
      apiMock,
    });

    await screen.findByText(hasTextAcrossElements('Ballot Count: 3,000'));
  });

  test('test mode', async () => {
    apiMock.expectGetCastVoteRecordFileMode('test');
    apiMock.expectGetTotalBallotCount(3000);

    renderInAppContext(<ReportsScreen />, {
      electionDefinition,
      apiMock,
    });

    await screen.findByText(hasTextAcrossElements('Test Ballot Count: 3,000'));
  });
});

describe('showing WIA report link', () => {
  const BUTTON_TEXT = 'Unofficial Write-In Adjudication Report';

  test('shown when election has write-in contests', async () => {
    apiMock.expectGetCastVoteRecordFileMode('test');
    apiMock.expectGetTotalBallotCount(3000);

    renderInAppContext(<ReportsScreen />, {
      electionDefinition,
      apiMock,
    });

    await screen.findButton(BUTTON_TEXT);
  });

  test('not shown when election does not write-in contests', async () => {
    apiMock.expectGetCastVoteRecordFileMode('test');
    apiMock.expectGetTotalBallotCount(3000);

    const electionDefinitionWithoutWriteIns: ElectionDefinition = {
      ...electionDefinition,
      election: {
        ...electionDefinition.election,
        contests: electionDefinition.election.contests.map((contest) => {
          if (contest.type === 'candidate') {
            return {
              ...contest,
              allowWriteIns: false,
            };
          }

          return contest;
        }),
      },
    };

    renderInAppContext(<ReportsScreen />, {
      electionDefinition: electionDefinitionWithoutWriteIns,
      apiMock,
    });

    await screen.findButton('Full Election Tally Report');
    expect(screen.queryByText(BUTTON_TEXT)).not.toBeInTheDocument();
  });
});
