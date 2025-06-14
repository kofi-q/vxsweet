import { join } from 'node:path';
import * as electionTwoPartyPrimary from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary/election.json';
import { assert } from '@vx/libs/basics/assert';
import {
  buildTestEnvironment,
  configureMachine,
  mockElectionManagerAuth,
} from '../test/app';
import { takeBackup } from '../test/backups';
import { getPerformanceTimer } from '../test/timer';

const electionTwoPartyPrimaryDefinition =
  electionTwoPartyPrimary.toElectionDefinition();

// depending on the test conditions, you may need to increase this
jest.setTimeout(3000000);

const electionDefinition = electionTwoPartyPrimaryDefinition;

// reports can be generated from "libs/fixture-generators"
const NUM_REPORTS = 100;
const RECORDS_PER_REPORT = 10000;

test('loading CVR file performance', async () => {
  const timer = getPerformanceTimer();
  const { api, workspace, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);
  timer.checkpoint(`test setup complete`);

  for (let i = 0; i < NUM_REPORTS; i += 1) {
    const reportDirectoryPath = join(
      __dirname,
      'fixtures',
      RECORDS_PER_REPORT.toString(),
      i.toString()
    );
    const addReportResult = await api.addCastVoteRecordFile({
      path: reportDirectoryPath,
    });
    assert(addReportResult.isOk());
    timer.checkpoint(`file ${i} added`);
  }

  // to experiment with the performance of querying or exporting these records,
  // we can save a backup. add the "override" argument if you want to overwrite
  // existing backups of the same name
  takeBackup({
    workspace,
    backupName: 'performance',
  });
});
