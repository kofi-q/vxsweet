import * as fixtures from '.';
import { election as electionGeneral } from '@vx/libs/fixtures/src/data/electionGeneral/election.json';

test('has various election definitions', () => {
  expect(
    Object.entries(fixtures)
      .filter(([, value]) => typeof value !== 'function')
      .map(([key]) => key)
      .sort()
  ).toMatchSnapshot();
});

test('asElectionDefinition', () => {
  expect(fixtures.asElectionDefinition(electionGeneral)).toStrictEqual(
    expect.objectContaining({
      election: electionGeneral,
      electionData: expect.any(String),
      ballotHash: expect.any(String),
    })
  );
});
