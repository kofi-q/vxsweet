import * as electionFamousNames2021Fixtures from '@vx/libs/fixtures/src/data/electionFamousNames2021';
import {
  type BatchInfo,
  DEFAULT_SYSTEM_SETTINGS,
  TEST_JURISDICTION,
} from '@vx/libs/types/elections';
import { mockElectionManagerAuth } from '../test/helpers/auth';
import { withApp } from '../test/helpers/setup_app';
import { generateBmdBallotFixture } from '../test/helpers/ballots';
import { type ScannedSheetInfo } from '../scanners/fujitsu/fujitsu_scanner';

const jurisdiction = TEST_JURISDICTION;

test('scanBatch with multiple sheets', async () => {
  const electionDefinition =
    electionFamousNames2021Fixtures.electionJson.toElectionDefinition();
  const ballot = await generateBmdBallotFixture();
  const scannedBallot: ScannedSheetInfo = {
    frontPath: ballot[0],
    backPath: ballot[1],
  };
  await withApp(async ({ auth, apiClient, scanner, importer, workspace }) => {
    mockElectionManagerAuth(auth, electionDefinition);
    importer.configure(
      electionDefinition,
      jurisdiction,
      'test-election-package-hash'
    );
    workspace.store.setSystemSettings(DEFAULT_SYSTEM_SETTINGS);
    await apiClient.setTestMode({ testMode: true });

    scanner
      .withNextScannerSession()
      .sheet(scannedBallot)
      .sheet(scannedBallot)
      .sheet(scannedBallot)
      .end();

    await apiClient.scanBatch();
    await importer.waitForEndOfBatchOrScanningPause();

    const status = await apiClient.getStatus();
    expect(status.adjudicationsRemaining).toEqual(0);
    expect(status.canUnconfigure).toEqual(true);
    expect(status.batches.length).toEqual(1);
    expect(status.batches[0]).toEqual<BatchInfo>({
      id: expect.any(String),
      batchNumber: 1,
      label: 'Batch 1',
      count: 3,
      startedAt: expect.any(String),
      endedAt: expect.any(String),
    });
  });
});

test('continueScanning after invalid ballot', async () => {
  const electionDefinition =
    electionFamousNames2021Fixtures.electionJson.toElectionDefinition();
  const ballot = await generateBmdBallotFixture();
  await withApp(async ({ auth, apiClient, scanner, importer, workspace }) => {
    mockElectionManagerAuth(auth, electionDefinition);
    importer.configure(
      electionDefinition,
      jurisdiction,
      'test-election-package-hash'
    );
    workspace.store.setSystemSettings(DEFAULT_SYSTEM_SETTINGS);
    await apiClient.setTestMode({ testMode: true });

    scanner
      .withNextScannerSession()
      .sheet({
        frontPath: ballot[0],
        backPath: ballot[1],
      })
      // Invalid BMD ballot
      .sheet({ frontPath: ballot[1], backPath: ballot[1] })
      .sheet({ frontPath: ballot[0], backPath: ballot[1] })
      .end();

    await apiClient.scanBatch();
    await importer.waitForEndOfBatchOrScanningPause();
    {
      const status = await apiClient.getStatus();
      expect(status.adjudicationsRemaining).toEqual(1);
      expect(status.canUnconfigure).toEqual(true);
      expect(status.batches.length).toEqual(1);
      expect(status.batches[0]).toEqual<BatchInfo>({
        id: expect.any(String),
        batchNumber: 1,
        label: 'Batch 1',
        count: 2,
        startedAt: expect.any(String),
        endedAt: undefined, // not ended
      });
    }
    await apiClient.continueScanning({ forceAccept: false });
    await importer.waitForEndOfBatchOrScanningPause();
    {
      const status = await apiClient.getStatus();
      expect(status.adjudicationsRemaining).toEqual(0);
      expect(status.canUnconfigure).toEqual(true);
      expect(status.batches.length).toEqual(1);
      expect(status.batches[0]).toEqual<BatchInfo>({
        id: expect.any(String),
        batchNumber: 1,
        label: 'Batch 1',
        count: 2, // bad ballot removed
        startedAt: expect.any(String),
        endedAt: expect.any(String),
      });
    }
  });
});
