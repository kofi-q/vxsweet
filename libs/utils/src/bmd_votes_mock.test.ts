import { electionTwoPartyPrimaryDefinition } from '@vx/libs/fixtures/src';
import { generateMockVotes } from './bmd_votes_mock';

test('generateMockVotes is consistent', () => {
  expect(generateMockVotes(electionTwoPartyPrimaryDefinition.election)).toEqual(
    generateMockVotes(electionTwoPartyPrimaryDefinition.election)
  );
});
