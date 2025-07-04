jest.mock(
  '@vx/libs/auth/artifacts',
  (): typeof import('@vx/libs/auth/artifacts') => ({
    ...jest.requireActual('@vx/libs/auth/artifacts'),
    authenticateArtifactUsingSignatureFile: jest.fn(),
  })
);

jest.mock('@vx/libs/utils/src', () => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag: BooleanEnvironmentVariableName) =>
      featureFlagMock.isEnabled(flag),
  };
});

import { Buffer } from 'node:buffer';
import set from 'lodash.set';
import { assert } from '@vx/libs/basics/assert';
import { err, ok } from '@vx/libs/basics/result';
import * as electionGridLayoutNewHampshireTestBallotFixtures from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot';
import * as electionTwoPartyPrimaryFixtures from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary';
import { LogEventId } from '@vx/libs/logging/src';
import { CVR, CVR as CVRType } from '@vx/libs/types/cdf';
import { CastVoteRecordExportFileName } from '@vx/libs/types/cvrs';
import path, { basename } from 'node:path';
import {
  BooleanEnvironmentVariableName,
  SCANNER_RESULTS_FOLDER,
  generateCastVoteRecordExportDirectoryName,
  generateElectionBasedSubfolderName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import { mockOf } from '@vx/libs/test-utils/src';
import { authenticateArtifactUsingSignatureFile } from '@vx/libs/auth/artifacts';
import {
  type CastVoteRecordExportModifications,
  combineImageAndLayoutHashes,
  getImageHash,
  getLayoutHash,
  modifyCastVoteRecordExport,
  readCastVoteRecordExportMetadata,
} from '@vx/libs/backend/cast_vote_records';
import { type MockFileTree } from '@vx/libs/usb-drive/src';
import {
  buildTestEnvironment,
  configureMachine,
  mockCastVoteRecordFileTree,
  mockElectionManagerAuth,
} from '../test/app';
import {
  type ListCastVoteRecordExportsOnUsbDriveResult,
  listCastVoteRecordExportsOnUsbDrive,
} from '../cvrs/cast_vote_records';
import { type CvrFileImportInfo } from '../types/types';

jest.setTimeout(60_000);

const electionTwoPartyPrimaryDefinition =
  electionTwoPartyPrimaryFixtures.electionJson.toElectionDefinition();

// mock SKIP_CVR_BALLOT_HASH_CHECK to allow us to use old cvr fixtures
const featureFlagMock = getFeatureFlagMock();

beforeEach(() => {
  jest.restoreAllMocks();
  mockOf(authenticateArtifactUsingSignatureFile).mockResolvedValue(ok());
  featureFlagMock.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_CVR_BALLOT_HASH_CHECK
  );
});

afterEach(() => {
  featureFlagMock.resetFeatureFlags();
});

const { castVoteRecordExport } =
  electionGridLayoutNewHampshireTestBallotFixtures;
const electionDefinition =
  electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionDefinition();

async function getOfficialReportPath(): Promise<string> {
  return await modifyCastVoteRecordExport(
    castVoteRecordExport.asDirectoryPath(),
    {
      castVoteRecordReportMetadataModifier: (castVoteRecordReportMetadata) => ({
        ...castVoteRecordReportMetadata,
        OtherReportType: undefined,
        ReportType: [CVRType.ReportType.OriginatingDeviceExport],
      }),
      numCastVoteRecordsToKeep: 10,
    }
  );
}

test('happy path - mock election flow', async () => {
  const { api, auth, mockUsbDrive, logger } = buildTestEnvironment();
  const { usbDrive, insertUsbDrive, removeUsbDrive } = mockUsbDrive;
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  // initially, no files or cast vote records
  expect(api.getCastVoteRecordFiles()).toHaveLength(0);
  expect(api.getCastVoteRecordFileMode()).toEqual('unlocked');
  expect(api.getTotalBallotCount()).toEqual(0);
  usbDrive.status.expectRepeatedCallsWith().resolves({ status: 'no_drive' });
  expect(await api.listCastVoteRecordFilesOnUsb()).toEqual([]);
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.ListCastVoteRecordExportsOnUsbDrive,
    {
      disposition: 'failure',
      message: 'Error listing cast vote record exports on USB drive.',
      reason: 'no-usb-drive',
    }
  );

  // insert a USB drive
  const testExportDirectoryName = 'TEST__machine_0000__2022-09-24_18-00-00';
  // The timestamp that the CVR fixtures were generated at
  const expectedExportTimestamp = (
    await readCastVoteRecordExportMetadata(
      castVoteRecordExport.asDirectoryPath()
    )
  ).unsafeUnwrap().castVoteRecordReportMetadata.GeneratedDate;
  insertUsbDrive(
    mockCastVoteRecordFileTree(electionDefinition, {
      [testExportDirectoryName]: castVoteRecordExport.asDirectoryPath(),
    })
  );
  const availableCastVoteRecordFiles = await api.listCastVoteRecordFilesOnUsb();
  expect(availableCastVoteRecordFiles).toMatchObject([
    expect.objectContaining({
      name: testExportDirectoryName,
      cvrCount: 184,
      exportTimestamp: new Date(expectedExportTimestamp),
      isTestModeResults: true,
      scannerIds: ['0000'],
    }),
  ]);
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.ListCastVoteRecordExportsOnUsbDrive,
    {
      disposition: 'success',
      message: 'Found 1 cast vote record export(s) on USB drive.',
    }
  );

  // add a file
  let exportDirectoryPath = availableCastVoteRecordFiles[0]!.path;
  const addTestFileResult = await api.addCastVoteRecordFile({
    path: exportDirectoryPath,
  });
  addTestFileResult.unsafeUnwrap();
  expect(addTestFileResult.ok()).toMatchObject<Omit<CvrFileImportInfo, 'id'>>({
    wasExistingFile: false,
    exportedTimestamp: expectedExportTimestamp,
    alreadyPresent: 0,
    newlyAdded: 184,
    fileMode: 'test',
    fileName: testExportDirectoryName,
  });
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.ImportCastVoteRecordsComplete,
    {
      disposition: 'success',
      message: 'Successfully imported 184 cast vote record(s).',
      exportDirectoryPath,
    }
  );

  removeUsbDrive();

  // file and cast vote records should now be present
  expect(api.getCastVoteRecordFiles()).toEqual([
    expect.objectContaining({
      exportTimestamp: expectedExportTimestamp,
      filename: testExportDirectoryName,
      numCvrsImported: 184,
      precinctIds: ['town-id-00701-precinct-id-default'],
      scannerIds: ['VX-00-000'],
    }),
  ]);
  expect(api.getCastVoteRecordFileMode()).toEqual('test');
  expect(api.getTotalBallotCount()).toEqual(184);

  // check write-in records were created
  expect(api.getWriteInAdjudicationQueue()).toHaveLength(80);

  // check scanner batches
  expect(api.getScannerBatches()).toEqual([
    expect.objectContaining({
      batchId: '9822c71014',
      label: '9822c71014',
      scannerId: 'VX-00-000',
    }),
  ]);

  // remove CVR files, expect clear state
  api.clearCastVoteRecordFiles();
  expect(api.getCastVoteRecordFiles()).toHaveLength(0);
  expect(api.getTotalBallotCount()).toEqual(0);

  expect(api.getCastVoteRecordFileMode()).toEqual('unlocked');

  const availableCastVoteRecordFiles3 =
    await api.listCastVoteRecordFilesOnUsb();
  expect(availableCastVoteRecordFiles3).toMatchObject([]);

  // now try loading official CVR files, as if after L&A
  const officialExportDirectoryName = 'machine_0000__2022-09-24_18-00-00';
  const officialExportTimestamp = expectedExportTimestamp;
  const officialReportDirectoryPath = await modifyCastVoteRecordExport(
    castVoteRecordExport.asDirectoryPath(),
    {
      castVoteRecordReportMetadataModifier: (castVoteRecordReportMetadata) => ({
        ...castVoteRecordReportMetadata,
        OtherReportType: undefined,
        ReportType: [CVRType.ReportType.OriginatingDeviceExport],
      }),
    }
  );
  insertUsbDrive(
    mockCastVoteRecordFileTree(electionDefinition, {
      [officialExportDirectoryName]: officialReportDirectoryPath,
    })
  );
  const availableCastVoteRecordFiles2 =
    await api.listCastVoteRecordFilesOnUsb();
  expect(availableCastVoteRecordFiles2).toMatchObject([
    expect.objectContaining({
      name: officialExportDirectoryName,
      cvrCount: 184,
      exportTimestamp: new Date(officialExportTimestamp),
      isTestModeResults: false,
      scannerIds: ['0000'],
    }),
  ]);
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.ListCastVoteRecordExportsOnUsbDrive,
    {
      disposition: 'success',
      message: 'Found 1 cast vote record export(s) on USB drive.',
    }
  );

  exportDirectoryPath = availableCastVoteRecordFiles2[0]!.path;
  const addLiveFileResult = await api.addCastVoteRecordFile({
    path: exportDirectoryPath,
  });
  assert(addLiveFileResult.isOk());
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.ImportCastVoteRecordsComplete,
    {
      disposition: 'success',
      message: 'Successfully imported 184 cast vote record(s).',
      exportDirectoryPath,
    }
  );
  removeUsbDrive();

  expect(api.getCastVoteRecordFiles()).toHaveLength(1);
  expect(api.getTotalBallotCount()).toEqual(184);
  expect(api.getCastVoteRecordFileMode()).toEqual('official');
});

test('adding a file with BMD cast vote records', async () => {
  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionTwoPartyPrimaryDefinition);
  mockElectionManagerAuth(auth, electionTwoPartyPrimaryDefinition.election);

  const addTestFileResult = await api.addCastVoteRecordFile({
    path: electionTwoPartyPrimaryFixtures.castVoteRecordExport.asDirectoryPath(),
  });
  assert(addTestFileResult.isOk());
  expect(addTestFileResult.ok()).toMatchObject({
    wasExistingFile: false,
    alreadyPresent: 0,
    newlyAdded: 112,
    fileMode: 'test',
  });

  // should now be able to retrieve the file
  expect(api.getCastVoteRecordFiles()).toEqual([
    expect.objectContaining({
      numCvrsImported: 112,
      precinctIds: ['precinct-1', 'precinct-2'],
      scannerIds: ['VX-00-000'],
    }),
  ]);
  expect(api.getCastVoteRecordFileMode()).toEqual('test');
  expect(api.getTotalBallotCount()).toEqual(112);

  // check that write-in records were added
  expect(api.getWriteInAdjudicationQueue()).toHaveLength(40);
});

test('handles duplicate exports', async () => {
  const { api, auth, logger } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  // initially, no files
  expect(api.getCastVoteRecordFiles()).toEqual([]);

  const exportDirectoryPath = castVoteRecordExport.asDirectoryPath();

  // add file once
  (
    await api.addCastVoteRecordFile({
      path: exportDirectoryPath,
    })
  ).assertOk('expected to load cast vote record report successfully');

  // try adding duplicate file
  const addDuplicateFileResult = await api.addCastVoteRecordFile({
    path: exportDirectoryPath,
  });
  assert(addDuplicateFileResult.isOk());
  expect(addDuplicateFileResult.ok()).toMatchObject({
    wasExistingFile: true,
    alreadyPresent: 184,
    newlyAdded: 0,
    fileMode: 'test',
    fileName: basename(exportDirectoryPath),
  });
  expect(api.getCastVoteRecordFiles()).toHaveLength(1);
  expect(api.getTotalBallotCount()).toEqual(184);
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.ImportCastVoteRecordsComplete,
    {
      disposition: 'success',
      message:
        'Successfully imported 0 cast vote record(s). Ignored 184 duplicate(s).',
      exportDirectoryPath,
    }
  );
});

test('handles file with previously added entries by adding only the new entries', async () => {
  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const initialReportDirectoryPath = await modifyCastVoteRecordExport(
    castVoteRecordExport.asDirectoryPath(),
    { numCastVoteRecordsToKeep: 10 }
  );
  // add file
  (
    await api.addCastVoteRecordFile({
      path: initialReportDirectoryPath,
    })
  ).assertOk('expected to load cast vote record report successfully');
  expect(api.getCastVoteRecordFiles()).toHaveLength(1);
  expect(api.getTotalBallotCount()).toEqual(10);

  // create file that is duplicate but with new entries
  const laterReportDirectoryPath = await modifyCastVoteRecordExport(
    castVoteRecordExport.asDirectoryPath(),
    { numCastVoteRecordsToKeep: 20 }
  );
  const addDuplicateEntriesResult = await api.addCastVoteRecordFile({
    path: laterReportDirectoryPath,
  });
  assert(addDuplicateEntriesResult.isOk());
  expect(addDuplicateEntriesResult.ok()).toMatchObject({
    wasExistingFile: false,
    newlyAdded: 10,
    alreadyPresent: 10,
    fileMode: 'test',
    fileName: basename(laterReportDirectoryPath),
  });
  expect(api.getCastVoteRecordFiles()).toHaveLength(2);
  expect(api.getTotalBallotCount()).toEqual(20);
});

test(
  'handles an export that is not a perfect duplicate of another export ' +
    'but ultimately does not contain any new cast vote records',
  async () => {
    const { api, auth } = buildTestEnvironment();
    await configureMachine(api, auth, electionDefinition);
    mockElectionManagerAuth(auth, electionDefinition.election);

    const export1DirectoryPath = await modifyCastVoteRecordExport(
      castVoteRecordExport.asDirectoryPath(),
      { numCastVoteRecordsToKeep: 10 }
    );
    const export2DirectoryPath = await modifyCastVoteRecordExport(
      castVoteRecordExport.asDirectoryPath(),
      {
        castVoteRecordReportMetadataModifier: (
          castVoteRecordReportMetadata
        ) => {
          const modifiedGeneratedDate = new Date(
            castVoteRecordReportMetadata.GeneratedDate
          );
          modifiedGeneratedDate.setMinutes(
            modifiedGeneratedDate.getMinutes() + 10
          );
          return {
            ...castVoteRecordReportMetadata,
            GeneratedDate: modifiedGeneratedDate.toISOString(),
          };
        },
        numCastVoteRecordsToKeep: 10,
      }
    );

    expect(
      await api.addCastVoteRecordFile({ path: export1DirectoryPath })
    ).toEqual(
      ok(
        expect.objectContaining({
          alreadyPresent: 0,
          fileMode: 'test',
          fileName: basename(export1DirectoryPath),
          newlyAdded: 10,
          wasExistingFile: false,
        })
      )
    );
    expect(
      await api.addCastVoteRecordFile({ path: export2DirectoryPath })
    ).toEqual(
      ok(
        expect.objectContaining({
          alreadyPresent: 10,
          fileMode: 'test',
          fileName: basename(export2DirectoryPath),
          newlyAdded: 0,
          wasExistingFile: false,
        })
      )
    );

    // Ensure that the second export is returned when retrieving exports, even though no new cast
    // vote records were added because of it
    const castVoteRecordExports = api.getCastVoteRecordFiles();
    expect(castVoteRecordExports).toHaveLength(2);
  }
);

test('error if path to report is not valid', async () => {
  const { api, auth, logger } = buildTestEnvironment();

  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const addNonExistentFileResult = await api.addCastVoteRecordFile({
    path: '/tmp/does-not-exist',
  });
  expect(addNonExistentFileResult.err()).toEqual({
    type: 'metadata-file-not-found',
  });
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.ImportCastVoteRecordsComplete,
    {
      disposition: 'failure',
      message: 'Error importing cast vote records.',
      exportDirectoryPath: '/tmp/does-not-exist',
      errorDetails: expect.stringContaining('metadata-file-not-found'),
    }
  );

  expect(api.getCastVoteRecordFiles()).toHaveLength(0);
  expect(api.getTotalBallotCount()).toEqual(0);
});

test('cast vote records authentication error', async () => {
  const { api, auth, logger } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  mockOf(authenticateArtifactUsingSignatureFile).mockResolvedValue(
    err(new Error('Whoa!'))
  );

  const exportDirectoryPath = castVoteRecordExport.asDirectoryPath();
  const result = await api.addCastVoteRecordFile({
    path: exportDirectoryPath,
  });
  expect(result).toEqual(
    err({
      type: 'authentication-error',
    })
  );
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.ImportCastVoteRecordsComplete,
    {
      disposition: 'failure',
      message: 'Error importing cast vote records.',
      exportDirectoryPath,
      errorDetails: expect.stringContaining('authentication-error'),
    }
  );
  expect(api.getCastVoteRecordFiles()).toHaveLength(0);
  expect(api.getTotalBallotCount()).toEqual(0);
});

test('cast vote records authentication error ignored if SKIP_CAST_VOTE_RECORDS_AUTHENTICATION is enabled', async () => {
  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  mockOf(authenticateArtifactUsingSignatureFile).mockResolvedValue(
    err(new Error('Whoa!'))
  );
  featureFlagMock.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_CAST_VOTE_RECORDS_AUTHENTICATION
  );

  const result = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  expect(result.isOk()).toEqual(true);
});

test('error if report metadata is not parseable', async () => {
  const { api, auth } = buildTestEnvironment();

  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const reportDirectoryPath = await modifyCastVoteRecordExport(
    castVoteRecordExport.asDirectoryPath(),
    {
      castVoteRecordReportMetadataModifier: (castVoteRecordReportMetadata) => ({
        ...castVoteRecordReportMetadata,
        ReportType: ['not-a-report-type' as CVRType.ReportType],
      }),
    }
  );

  const result = await api.addCastVoteRecordFile({
    path: reportDirectoryPath,
  });

  expect(result.err()).toMatchObject({
    type: 'metadata-file-parse-error',
  });

  expect(api.getCastVoteRecordFiles()).toHaveLength(0);
  expect(api.getTotalBallotCount()).toEqual(0);
});

test('error if adding test report while in official mode', async () => {
  const { api, auth } = buildTestEnvironment();

  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  (
    await api.addCastVoteRecordFile({
      path: await getOfficialReportPath(),
    })
  ).assertOk('expected to load cast vote record report successfully');

  const addTestReportResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });

  expect(addTestReportResult.isErr()).toBeTruthy();
  expect(addTestReportResult.err()).toMatchObject({
    type: 'invalid-mode',
  });
});

test('error if adding official report while in test mode', async () => {
  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  (
    await api.addCastVoteRecordFile({
      path: castVoteRecordExport.asDirectoryPath(),
    })
  ).assertOk('expected to load cast vote record report successfully');

  const addOfficialReportResult = await api.addCastVoteRecordFile({
    path: await getOfficialReportPath(),
  });

  expect(addOfficialReportResult.isErr()).toBeTruthy();
  expect(addOfficialReportResult.err()).toMatchObject({
    type: 'invalid-mode',
  });
});

test('error if a cast vote record not parseable', async () => {
  const { api, auth } = buildTestEnvironment();

  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const reportDirectoryPath = await modifyCastVoteRecordExport(
    castVoteRecordExport.asDirectoryPath(),
    {
      castVoteRecordModifier: () => ({}) as unknown as CVR.CVR,
      numCastVoteRecordsToKeep: 10,
    }
  );

  const result = await api.addCastVoteRecordFile({
    path: reportDirectoryPath,
  });

  expect(result.err()).toMatchObject({
    type: 'invalid-cast-vote-record',
    subType: 'parse-error',
  });

  expect(api.getCastVoteRecordFiles()).toHaveLength(0);
  expect(api.getTotalBallotCount()).toEqual(0);
});

test('error if a cast vote record is somehow invalid', async () => {
  featureFlagMock.disableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_CVR_BALLOT_HASH_CHECK
  );
  const { api, auth } = buildTestEnvironment();

  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const reportDirectoryPath = await modifyCastVoteRecordExport(
    castVoteRecordExport.asDirectoryPath(),
    {
      castVoteRecordModifier: (castVoteRecord) => ({
        ...castVoteRecord,
        ElectionId: 'wrong-election',
      }),
      numCastVoteRecordsToKeep: 10,
    }
  );

  const result = await api.addCastVoteRecordFile({
    path: reportDirectoryPath,
  });

  expect(result.err()).toMatchObject({
    type: 'invalid-cast-vote-record',
    subType: 'election-mismatch',
  });

  expect(api.getCastVoteRecordFiles()).toHaveLength(0);
  expect(api.getTotalBallotCount()).toEqual(0);
});

test('error if cast vote records from different files share same ballot id but have different data', async () => {
  const { api, auth } = buildTestEnvironment();

  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  (
    await api.addCastVoteRecordFile({
      path: castVoteRecordExport.asDirectoryPath(),
    })
  ).assertOk('expected to load cast vote record report successfully');

  expect(api.getCastVoteRecordFiles()).toHaveLength(1);
  expect(api.getTotalBallotCount()).toEqual(184);

  const reportDirectoryPath = await modifyCastVoteRecordExport(
    castVoteRecordExport.asDirectoryPath(),
    {
      castVoteRecordModifier: (castVoteRecord) => ({
        ...castVoteRecord,
        BallotSheetId: '2',
      }),
      numCastVoteRecordsToKeep: 10,
    }
  );

  const result = await api.addCastVoteRecordFile({
    path: reportDirectoryPath,
  });

  expect(result.err()).toMatchObject({
    type: 'ballot-id-already-exists-with-different-data',
  });

  expect(api.getCastVoteRecordFiles()).toHaveLength(1);
  expect(api.getTotalBallotCount()).toEqual(184);
});

test('specifying path to metadata file instead of path to export directory (for manual file selection)', async () => {
  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const importResult = await api.addCastVoteRecordFile({
    path: path.join(
      castVoteRecordExport.asDirectoryPath(),
      CastVoteRecordExportFileName.METADATA
    ),
  });
  expect(importResult.isOk()).toEqual(true);
});

test.each<{
  description: string;
  setupFn?: () => void;
  modifications: CastVoteRecordExportModifications;
  expectedErrorSubType: string;
}>([
  {
    description: 'mismatched election',
    setupFn: () => {
      featureFlagMock.disableFeatureFlag(
        BooleanEnvironmentVariableName.SKIP_CVR_BALLOT_HASH_CHECK
      );
    },
    modifications: {
      castVoteRecordModifier: (castVoteRecord) => ({
        ...castVoteRecord,
        ElectionId: 'mismatched-ballot-hash',
      }),
      numCastVoteRecordsToKeep: 1,
    },
    expectedErrorSubType: 'election-mismatch',
  },
  {
    description: 'non-existent precinct',
    modifications: {
      castVoteRecordModifier: (castVoteRecord) => ({
        ...castVoteRecord,
        BallotStyleUnitId: 'non-existent-precinct-id',
      }),
      numCastVoteRecordsToKeep: 1,
    },
    expectedErrorSubType: 'precinct-not-found',
  },
  {
    description: 'non-existent ballot style',
    modifications: {
      castVoteRecordModifier: (castVoteRecord) => ({
        ...castVoteRecord,
        BallotStyleId: 'non-existent-ballot-style-id',
      }),
      numCastVoteRecordsToKeep: 1,
    },
    expectedErrorSubType: 'ballot-style-not-found',
  },
  {
    description: 'non-existent contest',
    modifications: {
      castVoteRecordModifier: (castVoteRecord) =>
        set(
          castVoteRecord,
          'CVRSnapshot[0].CVRContest[0].ContestId',
          'non-existent-contest-id'
        ),
      numCastVoteRecordsToKeep: 1,
    },
    expectedErrorSubType: 'contest-not-found',
  },
  {
    description: 'incorrect image hash',
    modifications: {
      castVoteRecordModifier: (castVoteRecord) =>
        castVoteRecord.BallotImage
          ? set(
              castVoteRecord,
              'BallotImage[0].Hash.Value',
              combineImageAndLayoutHashes(
                'badhash',
                getLayoutHash(castVoteRecord.BallotImage[0]!)
              )
            )
          : castVoteRecord,
      numCastVoteRecordsToKeep: 10,
    },
    expectedErrorSubType: 'incorrect-image-hash',
  },
  {
    description: 'incorrect layout file hash',
    modifications: {
      castVoteRecordModifier: (castVoteRecord) =>
        castVoteRecord.BallotImage
          ? set(
              castVoteRecord,
              'BallotImage[0].Hash.Value',
              combineImageAndLayoutHashes(
                getImageHash(castVoteRecord.BallotImage[0]!),
                'badhash'
              )
            )
          : castVoteRecord,
      numCastVoteRecordsToKeep: 10,
    },
    expectedErrorSubType: 'incorrect-layout-file-hash',
  },
])(
  'invalid cast vote record - $description',
  async ({ setupFn, modifications, expectedErrorSubType }) => {
    const { api, auth } = buildTestEnvironment();
    await configureMachine(api, auth, electionDefinition);
    mockElectionManagerAuth(auth, electionDefinition.election);

    setupFn?.();
    const exportDirectoryPath = await modifyCastVoteRecordExport(
      castVoteRecordExport.asDirectoryPath(),
      modifications
    );

    expect(
      await api.addCastVoteRecordFile({ path: exportDirectoryPath })
    ).toEqual(
      err({
        type: 'invalid-cast-vote-record',
        subType: expectedErrorSubType,
        index: expect.any(Number),
      })
    );
  }
);

test.each<{
  description: string;
  usbDriveContentGenerator: () => MockFileTree;
  expectedResult: ListCastVoteRecordExportsOnUsbDriveResult;
}>([
  {
    description: 'empty USB drive',
    usbDriveContentGenerator: () => ({}),
    expectedResult: ok([]),
  },
  {
    description: 'file where there should be a directory',
    usbDriveContentGenerator: () => {
      const electionSubDirectoryName = generateElectionBasedSubfolderName(
        electionDefinition.election,
        electionDefinition.ballotHash
      );
      return {
        [electionSubDirectoryName]: {
          [SCANNER_RESULTS_FOLDER]: Buffer.of(),
        },
      };
    },
    expectedResult: err('found-file-instead-of-directory'),
  },
  {
    description:
      "directories that aren't export directories and empty export directories",
    usbDriveContentGenerator: () => {
      const electionSubDirectoryName = generateElectionBasedSubfolderName(
        electionDefinition.election,
        electionDefinition.ballotHash
      );
      const emptyExportDirectoryName =
        generateCastVoteRecordExportDirectoryName({
          inTestMode: true,
          machineId: '0000',
        });
      const exportDirectoryName = generateCastVoteRecordExportDirectoryName({
        inTestMode: true,
        machineId: '0001',
      });
      return {
        [electionSubDirectoryName]: {
          [SCANNER_RESULTS_FOLDER]: {
            'not-an-export-directory-name': {}, // Should be ignored
            [emptyExportDirectoryName]: {}, // Should be ignored
            [exportDirectoryName]: castVoteRecordExport.asDirectoryPath(),
          },
        },
      };
    },
    expectedResult: ok([
      expect.objectContaining({ name: expect.stringContaining('0001') }),
    ]),
  },
])(
  'listCastVoteRecordExportsOnUsbDrive - $description',
  async ({ usbDriveContentGenerator, expectedResult }) => {
    const { api, auth, mockUsbDrive } = buildTestEnvironment();
    await configureMachine(api, auth, electionDefinition);
    mockElectionManagerAuth(auth, electionDefinition.election);

    mockUsbDrive.insertUsbDrive(usbDriveContentGenerator());
    expect(
      await listCastVoteRecordExportsOnUsbDrive(
        mockUsbDrive.usbDrive,
        electionDefinition
      )
    ).toEqual(expectedResult);
  }
);
