jest.mock('@vx/libs/utils/src', () => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag: BooleanEnvironmentVariableName) =>
      featureFlagMock.isEnabled(flag),
  };
});

import * as electionTwoPartyPrimaryFixtures from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import { buildManualResultsFixture } from '@vx/libs/utils/src/tabulation';
import { type BallotStyleGroupId } from '@vx/libs/types/elections';
import {
  buildTestEnvironment,
  configureMachine,
  mockElectionManagerAuth,
} from '../test/app';

jest.setTimeout(60_000);

// mock SKIP_CVR_BALLOT_HASH_CHECK to allow us to use old cvr fixtures
const featureFlagMock = getFeatureFlagMock();

beforeEach(() => {
  jest.restoreAllMocks();
  featureFlagMock.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_CVR_BALLOT_HASH_CHECK
  );
  featureFlagMock.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_CAST_VOTE_RECORDS_AUTHENTICATION
  );
});

afterEach(() => {
  featureFlagMock.resetFeatureFlags();
});

test('card counts', async () => {
  const { castVoteRecordExport } = electionTwoPartyPrimaryFixtures;
  const electionDefinition =
    electionTwoPartyPrimaryFixtures.electionJson.toElectionDefinition();
  const { election } = electionDefinition;

  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  loadFileResult.assertOk('load file failed');

  await api.setManualResults({
    precinctId: 'precinct-1',
    ballotStyleGroupId: '1M' as BallotStyleGroupId,
    votingMethod: 'precinct',
    manualResults: buildManualResultsFixture({
      election,
      ballotCount: 10,
      contestResultsSummaries: {},
    }),
  });

  expect(
    api.getCardCounts({
      filter: { ballotStyleGroupIds: ['1M'] as BallotStyleGroupId[] },
      groupBy: {},
    })
  ).toEqual([
    {
      bmd: 56,
      hmpb: [],
      manual: 10,
    },
  ]);

  expect(
    api.getCardCounts({
      filter: {},
      groupBy: { groupByPrecinct: true },
    })
  ).toEqual([
    {
      precinctId: 'precinct-1',
      bmd: 56,
      hmpb: [],
      manual: 10,
    },
    {
      precinctId: 'precinct-2',
      bmd: 56,
      hmpb: [],
      manual: 0,
    },
  ]);

  expect(
    api.getCardCounts({
      filter: { ballotStyleGroupIds: ['1M'] as BallotStyleGroupId[] },
      groupBy: { groupByPrecinct: true },
    })
  ).toEqual([
    {
      precinctId: 'precinct-1',
      bmd: 28,
      hmpb: [],
      manual: 10,
    },
    {
      precinctId: 'precinct-2',
      bmd: 28,
      hmpb: [],
      manual: 0,
    },
  ]);
});
