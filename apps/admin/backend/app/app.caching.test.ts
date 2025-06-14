jest.mock('@vx/libs/utils/src', () => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag: BooleanEnvironmentVariableName) =>
      featureFlagMock.isEnabled(flag),
  };
});

import * as electionGridLayoutNewHampshireTestBallotFixtures from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot';
import { tmpNameSync } from 'tmp';
import { readFileSync } from 'node:fs';
import { assert } from '@vx/libs/basics/assert';
import { ok } from '@vx/libs/basics/result';
import { modifyCastVoteRecordExport } from '@vx/libs/backend/cast_vote_records';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import {
  buildTestEnvironment,
  configureMachine,
  mockElectionManagerAuth,
} from '../test/app';
import { parseCsv } from '../test/csv';
import { type Api } from './app';

// enable us to use modified fixtures that don't pass authentication
const featureFlagMock = getFeatureFlagMock();
featureFlagMock.enableFeatureFlag(
  BooleanEnvironmentVariableName.SKIP_CAST_VOTE_RECORDS_AUTHENTICATION
);
featureFlagMock.enableFeatureFlag(
  BooleanEnvironmentVariableName.SKIP_CVR_BALLOT_HASH_CHECK
);

async function getParsedExport({
  api,
}: {
  api: Api;
}): Promise<ReturnType<typeof parseCsv>> {
  const path = tmpNameSync();
  const exportResult = await api.exportTallyReportCsv({
    path,
    filter: {},
    groupBy: {},
  });
  expect(exportResult.isOk()).toEqual(true);
  return parseCsv(readFileSync(path, 'utf-8').toString());
}

// TODO: Improve performance - loading a lot of files into the server, but we'd
// get the same coverage with a small sample.
it('uses and clears CVR tabulation cache appropriately', async () => {
  const { castVoteRecordExport } =
    electionGridLayoutNewHampshireTestBallotFixtures;
  const electionDefinition =
    electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionDefinition();

  const { api, auth, workspace } = buildTestEnvironment();
  const { store } = workspace;

  // The purpose of caching is to avoid reloading and re-tabulating the same
  // cast vote records repeatedly. We can use of the store's CVR accessor
  // as a proxy for whether results are tabulated from scratch.
  const tabulationSpy = jest.spyOn(store, 'getCastVoteRecords');

  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const zeroExport = await getParsedExport({
    api,
  });
  expect(tabulationSpy).toHaveBeenCalledTimes(1);
  expect(zeroExport.rows.every((row) => row['Total Votes'] === '0')).toEqual(
    true
  );

  // adding a CVR file should should clear the cache
  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  expect(loadFileResult).toEqual(ok(expect.anything()));
  const resultsExport = await getParsedExport({
    api,
  });
  expect(tabulationSpy).toHaveBeenCalledTimes(2);
  expect(resultsExport).not.toEqual(zeroExport);

  // loading the same results should not trigger a tabulation
  const resultsExportFromCache = await getParsedExport({
    api,
  });
  expect(tabulationSpy).toHaveBeenCalledTimes(2);
  expect(resultsExportFromCache).toEqual(resultsExport);

  // adding another CVR file should should clear the cache again
  const loadFileAgainResult = await api.addCastVoteRecordFile({
    path: await modifyCastVoteRecordExport(
      castVoteRecordExport.asDirectoryPath(),
      {
        castVoteRecordModifier: (castVoteRecord) => ({
          ...castVoteRecord,
          UniqueId: `${castVoteRecord.UniqueId}'`,
        }),
      }
    ),
  });
  loadFileAgainResult.assertOk('load file failed');
  const doubledResultsExport = await getParsedExport({
    api,
  });
  expect(tabulationSpy).toHaveBeenCalledTimes(3);
  expect(doubledResultsExport).not.toEqual(resultsExport);

  // adjudicating a mark as a non-vote (by invalidating a write-in) should clear the cache
  const [writeInId] = api.getWriteInAdjudicationQueue({
    contestId: 'State-Representatives-Hillsborough-District-34-b1012d38',
  });
  assert(writeInId !== undefined);
  api.adjudicateWriteIn({
    writeInId,
    type: 'invalid',
  });
  const resultsExportAfterAdjudication = await getParsedExport({
    api,
  });
  expect(tabulationSpy).toHaveBeenCalledTimes(4);
  expect(resultsExportAfterAdjudication).not.toEqual(doubledResultsExport);

  // adjudicating a mark as a vote (by un-invalidating a write-in) should clear the cache
  api.adjudicateWriteIn({
    writeInId,
    type: 'official-candidate',
    candidateId: 'Obadiah-Carrigan-5c95145a',
  });
  const resultsExportAfterReAdjudication = await getParsedExport({
    api,
  });
  expect(tabulationSpy).toHaveBeenCalledTimes(5);
  expect(resultsExportAfterReAdjudication).not.toEqual(
    resultsExportAfterAdjudication
  );

  // deleting CVR files should clear the cache
  api.clearCastVoteRecordFiles();
  const clearedResultsExport = await getParsedExport({
    api,
  });
  expect(tabulationSpy).toHaveBeenCalledTimes(6);
  expect(clearedResultsExport).toEqual(zeroExport);
}, 20_000);
