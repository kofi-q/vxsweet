import { electionTwoPartyPrimaryDefinition } from '@vx/libs/fixtures/src';
import { buildTestEnvironment, mockElectionManagerAuth } from '../test/app';
import { getBackupPath } from '../test/backups';
import { getPerformanceTimer } from '../test/timer';

jest.setTimeout(30000);

const electionDefinition = electionTwoPartyPrimaryDefinition;

test.skip('tally performance', async () => {
  const timer = getPerformanceTimer();
  const { apiClient, auth } = buildTestEnvironment(
    getBackupPath('performance')
  );
  mockElectionManagerAuth(auth, electionDefinition.election);
  timer.checkpoint(`test setup complete`);
  await apiClient.getResultsForTallyReports();
  timer.end();
});
