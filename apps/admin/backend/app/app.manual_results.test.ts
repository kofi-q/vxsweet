import * as electionTwoPartyPrimaryFixtures from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary';

import {
  type BallotStyleGroupId,
  type PrecinctId,
} from '@vx/libs/types/elections';
import { Tabulation } from '@vx/libs/types/tabulation';
import { buildManualResultsFixture } from '@vx/libs/utils/src/tabulation';
import { assert } from '@vx/libs/basics/assert';
import { LogEventId } from '@vx/libs/logging/src';
import {
  buildTestEnvironment,
  configureMachine,
  mockElectionManagerAuth,
} from '../test/app';
import { type ManualResultsIdentifier } from '../types/types';

beforeEach(() => {
  jest.restoreAllMocks();
});

const electionDefinition =
  electionTwoPartyPrimaryFixtures.electionJson.toElectionDefinition();
const { election } = electionDefinition;

test('manual results flow (official candidates only)', async () => {
  const { api, auth, logger } = buildTestEnvironment();

  await configureMachine(api, auth, electionDefinition);

  mockElectionManagerAuth(auth, electionDefinition.election);

  // define some manual tallies... manually
  const resultsPrecinct1MammalBallotStyle = buildManualResultsFixture({
    election,
    ballotCount: 10,
    // Invalid - ballot count does not match the sum of the tallies
    contestResultsSummaries: {
      'best-animal-mammal': {
        type: 'candidate',
        overvotes: 0,
        undervotes: 0,
        ballots: 10,
        officialOptionTallies: {
          horse: 4,
          otter: 3,
          fox: 2,
        },
      },
    },
  });

  const resultsPrecinct2MammalBallotStyle = buildManualResultsFixture({
    election,
    ballotCount: 10,
    contestResultsSummaries: {
      'best-animal-mammal': {
        type: 'candidate',
        overvotes: 0,
        undervotes: 1,
        ballots: 10,
        officialOptionTallies: {
          horse: 2,
          otter: 3,
          fox: 4,
        },
      },
    },
  });

  const resultsPrecinct1FishBallotStyle = buildManualResultsFixture({
    election,
    ballotCount: 10,
    contestResultsSummaries: {
      'best-animal-fish': {
        type: 'candidate',
        overvotes: 1,
        undervotes: 0,
        ballots: 10,
        officialOptionTallies: {
          seahorse: 4,
          salmon: 5,
        },
      },
    },
  });

  const resultsPrecinct2FishBallotStyle = buildManualResultsFixture({
    election,
    ballotCount: 10,
    contestResultsSummaries: {
      'best-animal-fish': {
        type: 'candidate',
        overvotes: 0,
        undervotes: 1,
        ballots: 10,
        officialOptionTallies: {
          seahorse: 5,
          salmon: 4,
        },
      },
    },
  });
  // Incomplete - missing tallies for a contest
  delete resultsPrecinct2FishBallotStyle.contestResults[
    'aquarium-council-fish'
  ];

  // check there is initially no manual results data
  expect(api.getManualResultsMetadata()).toEqual([]);
  expect(
    api.getManualResults({
      precinctId: 'precinct-1',
      ballotStyleGroupId: '1M' as BallotStyleGroupId,
      votingMethod: 'precinct',
    })
  ).toBeNull();

  // add our manual results
  const manualResultsToAdd: Array<
    [
      precinctId: PrecinctId,
      ballotStyleGroupId: BallotStyleGroupId,
      manualResults: Tabulation.ManualElectionResults,
    ]
  > = [
    [
      'precinct-1',
      '1M' as BallotStyleGroupId,
      resultsPrecinct1MammalBallotStyle,
    ],
    ['precinct-1', '2F' as BallotStyleGroupId, resultsPrecinct1FishBallotStyle],
    [
      'precinct-2',
      '1M' as BallotStyleGroupId,
      resultsPrecinct2MammalBallotStyle,
    ],
    ['precinct-2', '2F' as BallotStyleGroupId, resultsPrecinct2FishBallotStyle],
  ];

  for (const [
    precinctId,
    ballotStyleGroupId,
    manualResults,
  ] of manualResultsToAdd) {
    await api.setManualResults({
      precinctId,
      ballotStyleGroupId,
      votingMethod: 'precinct',
      manualResults,
    });
    expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
      LogEventId.ManualTallyDataEdited,
      {
        disposition: 'success',
        message:
          'User added or edited manually entered tally data for a particular ballot style, precinct, and voting method.',
        ballotCount: manualResults.ballotCount,
        ballotStyleGroupId,
        precinctId,
        ballotType: 'precinct',
      }
    );
  }

  // check metadata request
  const manualResultsMetadataRecords = api.getManualResultsMetadata();
  expect(manualResultsMetadataRecords).toHaveLength(4);
  const [
    precinct1MammalMetadata,
    precinct1FishMetadata,
    precinct2MammalMetadata,
    precinct2FishMetadata,
  ] = [...manualResultsMetadataRecords].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  expect(precinct1MammalMetadata).toEqual({
    precinctId: 'precinct-1',
    ballotStyleGroupId: '1M',
    votingMethod: 'precinct',
    ballotCount: resultsPrecinct1MammalBallotStyle.ballotCount,
    createdAt: expect.any(String),
    validationError: 'invalid',
  });
  expect(precinct1FishMetadata).toEqual({
    precinctId: 'precinct-1',
    ballotStyleGroupId: '2F',
    votingMethod: 'precinct',
    ballotCount: resultsPrecinct1FishBallotStyle.ballotCount,
    createdAt: expect.any(String),
    validationError: undefined,
  });
  expect(precinct2MammalMetadata).toEqual({
    precinctId: 'precinct-2',
    ballotStyleGroupId: '1M',
    votingMethod: 'precinct',
    ballotCount: resultsPrecinct2MammalBallotStyle.ballotCount,
    createdAt: expect.any(String),
    validationError: undefined,
  });
  expect(precinct2FishMetadata).toEqual({
    precinctId: 'precinct-2',
    ballotStyleGroupId: '2F',
    votingMethod: 'precinct',
    ballotCount: resultsPrecinct2FishBallotStyle.ballotCount,
    createdAt: expect.any(String),
    validationError: 'incomplete',
  });

  // check retrieving individual tally
  const manualResultsRecord = api.getManualResults({
    precinctId: 'precinct-1',
    ballotStyleGroupId: '1M' as BallotStyleGroupId,
    votingMethod: 'precinct',
  });
  assert(manualResultsRecord);
  expect(manualResultsRecord.manualResults).toEqual(
    resultsPrecinct1MammalBallotStyle
  );
  expect(manualResultsRecord.ballotStyleGroupId).toEqual('1M');
  expect(manualResultsRecord.precinctId).toEqual('precinct-1');
  expect(manualResultsRecord.votingMethod).toEqual('precinct');

  // delete a single manual tally
  const deletedResultsIdentifier: ManualResultsIdentifier = {
    ballotStyleGroupId: '1M' as BallotStyleGroupId,
    precinctId: 'precinct-1',
    votingMethod: 'precinct',
  };
  expect(api.getManualResultsMetadata()).toHaveLength(4);
  api.deleteManualResults(deletedResultsIdentifier);
  expect(api.getManualResultsMetadata()).toHaveLength(3);
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.ManualTallyDataRemoved,
    {
      disposition: 'success',
      message:
        'User removed manually entered tally data for a particular ballot style, precinct, and voting method.',
      ...deletedResultsIdentifier,
    }
  );

  // delete all manual tallies
  api.deleteAllManualResults();
  expect(api.getManualResultsMetadata()).toHaveLength(0);
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.ManualTallyDataRemoved,
    {
      disposition: 'success',
      message: 'User removed all manually entered tally data.',
    }
  );
});

test('ignores write-ins with zero votes', async () => {
  const { api, auth } = buildTestEnvironment();

  await configureMachine(api, auth, electionDefinition);

  mockElectionManagerAuth(auth, electionDefinition.election);

  const manualResultsWithZeroCountWriteIns = buildManualResultsFixture({
    election,
    ballotCount: 10,
    contestResultsSummaries: {
      'best-animal-mammal': {
        type: 'candidate',
        overvotes: 1,
        undervotes: 0,
        ballots: 10,
        officialOptionTallies: {
          horse: 4,
          otter: 3,
          fox: 2,
        },
        writeInOptionTallies: {
          chimera: {
            tally: 0,
            name: 'Chimera',
          },
          'temp-write-in-(Bob)': {
            tally: 0,
            name: 'Bob',
          },
        },
      },
    },
  });

  await api.setManualResults({
    precinctId: 'precinct-1',
    votingMethod: 'precinct',
    ballotStyleGroupId: '1M' as BallotStyleGroupId,
    manualResults: manualResultsWithZeroCountWriteIns,
  });

  // check results after setting a tally with a zero write-in candidate
  expect(api.getWriteInCandidates()).toHaveLength(0);
  expect(
    api.getManualResults({
      precinctId: 'precinct-1',
      votingMethod: 'precinct',
      ballotStyleGroupId: '1M' as BallotStyleGroupId,
    })?.manualResults
  ).toEqual(
    buildManualResultsFixture({
      election,
      ballotCount: 10,
      contestResultsSummaries: {
        'best-animal-mammal': {
          type: 'candidate',
          overvotes: 1,
          undervotes: 0,
          ballots: 10,
          officialOptionTallies: {
            horse: 4,
            otter: 3,
            fox: 2,
          },
        },
      },
    })
  );
});

test('adds temp write-in candidates', async () => {
  const { api, auth } = buildTestEnvironment();

  await configureMachine(api, auth, electionDefinition);

  mockElectionManagerAuth(auth, electionDefinition.election);

  // initially no write-in candidates
  expect(api.getWriteInCandidates()).toHaveLength(0);

  const manualResultsWithTempWriteIn = buildManualResultsFixture({
    election,
    ballotCount: 10,
    contestResultsSummaries: {
      'best-animal-mammal': {
        type: 'candidate',
        overvotes: 1,
        undervotes: 0,
        ballots: 10,
        officialOptionTallies: {
          horse: 4,
          otter: 3,
          fox: 2,
        },
        writeInOptionTallies: {
          'temp-write-in-(Bob)': {
            tally: 1,
            name: 'Bob',
          },
        },
      },
    },
  });

  await api.setManualResults({
    precinctId: 'precinct-1',
    votingMethod: 'precinct',
    ballotStyleGroupId: '1M' as BallotStyleGroupId,
    manualResults: manualResultsWithTempWriteIn,
  });

  const writeInCandidates = api.getWriteInCandidates();
  expect(writeInCandidates).toHaveLength(1);
  const writeInCandidateId = writeInCandidates[0]!.id;

  expect(
    api.getManualResults({
      precinctId: 'precinct-1',
      votingMethod: 'precinct',
      ballotStyleGroupId: '1M' as BallotStyleGroupId,
    })?.manualResults
  ).toEqual(
    buildManualResultsFixture({
      election,
      ballotCount: 10,
      contestResultsSummaries: {
        'best-animal-mammal': {
          type: 'candidate',
          overvotes: 1,
          undervotes: 0,
          ballots: 10,
          officialOptionTallies: {
            horse: 4,
            otter: 3,
            fox: 2,
          },
          writeInOptionTallies: {
            [writeInCandidateId]: {
              tally: 1,
              name: 'Bob',
            },
          },
        },
      },
    })
  );
});

test('removes write-in candidates not referenced anymore', async () => {
  const { api, auth } = buildTestEnvironment();

  await configureMachine(api, auth, electionDefinition);

  mockElectionManagerAuth(auth, electionDefinition.election);

  expect(api.getWriteInCandidates()).toHaveLength(0);

  api.addWriteInCandidate({
    contestId: 'best-animal-mammal',
    name: 'Chimera',
  });
  const writeInCandidates = api.getWriteInCandidates();
  expect(writeInCandidates).toHaveLength(1);
  const writeInCandidateId = writeInCandidates[0]!.id;

  const manualResultsWithExistingWriteIn = buildManualResultsFixture({
    election,
    ballotCount: 10,
    contestResultsSummaries: {
      'best-animal-mammal': {
        type: 'candidate',
        overvotes: 1,
        undervotes: 0,
        ballots: 10,
        officialOptionTallies: {
          horse: 4,
          otter: 3,
          fox: 2,
        },
        writeInOptionTallies: {
          [writeInCandidateId]: {
            tally: 1,
            name: 'Chimera',
          },
        },
      },
    },
  });
  await api.setManualResults({
    precinctId: 'precinct-1',
    votingMethod: 'precinct',
    ballotStyleGroupId: '1M' as BallotStyleGroupId,
    manualResults: manualResultsWithExistingWriteIn,
  });
  expect(api.getWriteInCandidates()).toHaveLength(1);
  expect(
    api.getManualResults({
      precinctId: 'precinct-1',
      votingMethod: 'precinct',
      ballotStyleGroupId: '1M' as BallotStyleGroupId,
    })?.manualResults
  ).toEqual(manualResultsWithExistingWriteIn);

  const manualResultsWithWriteInRemoved = buildManualResultsFixture({
    election,
    ballotCount: 10,
    contestResultsSummaries: {
      'best-animal-mammal': {
        type: 'candidate',
        overvotes: 1,
        undervotes: 0,
        ballots: 10,
        officialOptionTallies: {
          horse: 4,
          otter: 3,
          fox: 2,
        },
      },
    },
  });
  await api.setManualResults({
    precinctId: 'precinct-1',
    votingMethod: 'precinct',
    ballotStyleGroupId: '1M' as BallotStyleGroupId,
    manualResults: manualResultsWithWriteInRemoved,
  });
  expect(api.getWriteInCandidates()).toHaveLength(0);
  expect(
    api.getManualResults({
      precinctId: 'precinct-1',
      votingMethod: 'precinct',
      ballotStyleGroupId: '1M' as BallotStyleGroupId,
    })?.manualResults
  ).toEqual(manualResultsWithWriteInRemoved);
});
