import { election as electionTwoPartyPrimary } from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary/election.json';
import { buildTestEnvironment, mockElectionManagerAuth } from '../test/app';
import { getBackupPath } from '../test/backups';
import { getPerformanceTimer } from '../test/timer';
const electionTwoPartyPrimaryDefinition = {
  election: electionTwoPartyPrimary,
} as const;

jest.setTimeout(30000);

const electionDefinition = electionTwoPartyPrimaryDefinition;

test.skip('tally performance', async () => {
  const timer = getPerformanceTimer();
  const { api, auth } = buildTestEnvironment(getBackupPath('performance'));
  mockElectionManagerAuth(auth, electionDefinition.election);
  timer.checkpoint(`test setup complete`);
  await api.getResultsForTallyReports();
  timer.end();
});
