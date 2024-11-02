import {
  electionFamousNames2021Fixtures,
  electionGeneralDefinition,
  electionGridLayoutNewHampshireTestBallotFixtures,
} from '@vx/libs/fixtures/src';
import { getMaxSheetsPerBallot } from './elections';

test('getMaxSheetsPerBallot', () => {
  // election with no gridLayouts available
  expect(
    getMaxSheetsPerBallot(electionGeneralDefinition.election)
  ).toBeUndefined();

  // single page election
  expect(
    getMaxSheetsPerBallot(
      electionGridLayoutNewHampshireTestBallotFixtures.election
    )
  ).toEqual(1);

  // multi-page election
  expect(
    getMaxSheetsPerBallot(electionFamousNames2021Fixtures.multiSheetElection)
  ).toEqual(3);
});
