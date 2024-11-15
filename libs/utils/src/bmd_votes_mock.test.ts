import { election as electionTwoPartyPrimary } from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary/election.json';
import { generateMockVotes } from './bmd_votes_mock';
const electionTwoPartyPrimaryDefinition = {
  election: electionTwoPartyPrimary,
} as const;

test('generateMockVotes is consistent', () => {
  expect(generateMockVotes(electionTwoPartyPrimaryDefinition.election)).toEqual(
    generateMockVotes(electionTwoPartyPrimaryDefinition.election)
  );
});
