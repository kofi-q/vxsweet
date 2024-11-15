import { getMaxSheetsPerBallot } from './elections';
import { election as electionGeneral } from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { election as electionGridLayoutNewHampshire } from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot/election.json';
import * as electionFamousNames2021Fixtures from '@vx/libs/fixtures/src/data/electionFamousNames2021';

test('getMaxSheetsPerBallot', () => {
  // election with no gridLayouts available
  expect(getMaxSheetsPerBallot(electionGeneral)).toBeUndefined();

  // single page election
  expect(getMaxSheetsPerBallot(electionGridLayoutNewHampshire)).toEqual(1);

  // multi-page election
  expect(
    getMaxSheetsPerBallot(electionFamousNames2021Fixtures.multiSheetElection)
  ).toEqual(3);
});
