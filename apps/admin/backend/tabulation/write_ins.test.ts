import { election } from '@vx/libs/fixtures/src/data/electionFamousNames2021/election.json';
import { combineElectionWriteInSummaries } from './write_ins';

test('getEmptyElectionWriteInSummary', () => {
  expect(
    combineElectionWriteInSummaries(
      {
        contestWriteInSummaries: {
          mayor: {
            contestId: 'mayor',
            totalTally: 50,
            pendingTally: 7,
            invalidTally: 9,
            candidateTallies: {
              'sherlock-holmes': {
                id: 'sherlock-holmes',
                name: 'Sherlock Holmes',
                tally: 5,
              },
              'thomas-edison': {
                id: 'thomas-edison',
                name: 'Thomas Edison',
                tally: 8,
              },
              'a-write-in': {
                id: 'a-write-in',
                name: 'A Write-In',
                tally: 21,
              },
            },
          },
          'chief-of-police': {
            contestId: 'chief-of-police',
            totalTally: 50,
            pendingTally: 50,
            invalidTally: 0,
            candidateTallies: {},
          },
        },
      },
      {
        contestWriteInSummaries: {
          mayor: {
            contestId: 'mayor',
            totalTally: 70,
            pendingTally: 13,
            invalidTally: 17,
            candidateTallies: {
              'sherlock-holmes': {
                id: 'sherlock-holmes',
                name: 'Sherlock Holmes',
                tally: 1,
              },
              'thomas-edison': {
                id: 'thomas-edison',
                name: 'Thomas Edison',
                tally: 2,
              },
              'b-write-in': {
                id: 'b-write-in',
                name: 'B Write-In',
                tally: 37,
              },
            },
          },
          controller: {
            contestId: 'controller',
            totalTally: 50,
            pendingTally: 50,
            invalidTally: 0,
            candidateTallies: {},
          },
        },
      },
      election
    )
  ).toEqual({
    contestWriteInSummaries: {
      'chief-of-police': {
        candidateTallies: {},
        contestId: 'chief-of-police',
        invalidTally: 0,
        pendingTally: 50,
        totalTally: 50,
      },
      controller: {
        candidateTallies: {},
        contestId: 'controller',
        invalidTally: 0,
        pendingTally: 50,
        totalTally: 50,
      },
      mayor: {
        candidateTallies: {
          'a-write-in': {
            id: 'a-write-in',
            name: 'A Write-In',
            tally: 21,
          },
          'b-write-in': {
            id: 'b-write-in',
            name: 'B Write-In',
            tally: 37,
          },
          'sherlock-holmes': {
            id: 'sherlock-holmes',
            name: 'Sherlock Holmes',
            tally: 6,
          },
          'thomas-edison': {
            id: 'thomas-edison',
            name: 'Thomas Edison',
            tally: 10,
          },
        },
        contestId: 'mayor',
        invalidTally: 26,
        pendingTally: 20,
        totalTally: 120,
      },
    },
  });
});
