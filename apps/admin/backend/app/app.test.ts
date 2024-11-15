jest.mock('../globals/globals', (): typeof import('../globals/globals') => ({
  ...jest.requireActual('../globals/globals'),
  get NODE_ENV(): 'production' | 'test' {
    return mockNodeEnv;
  },
}));

import { assert, assertDefined } from '@vx/libs/basics/assert';
import { err, ok } from '@vx/libs/basics/result';
import * as electionTwoPartyPrimaryFixtures from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary';
import * as electionTwoPartyPrimary from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary/election.json';
import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { LogEventId } from '@vx/libs/logging/src';
import { Buffer } from 'node:buffer';
import {
  type BallotStyleGroupId,
  DEFAULT_SYSTEM_SETTINGS,
  ElectionPackageFileName,
} from '@vx/libs/types/elections';
import { safeParseElectionDefinition } from '@vx/libs/types/election-parsing';
import {
  convertVxfElectionToCdfBallotDefinition,
  testElectionReport,
  testElectionReportUnsupportedContestType,
} from '@vx/libs/types/cdf';
import { type PrinterStatus } from '@vx/libs/types/printing';
import { suppressingConsoleOutput, zipFile } from '@vx/libs/test-utils/src';
import {
  HP_LASER_PRINTER_CONFIG,
  getMockConnectedPrinterStatus,
} from '@vx/libs/printing/src/printer';
import { tmpNameSync } from 'tmp';
import { writeFile } from 'node:fs/promises';
import {
  buildTestEnvironment,
  configureMachine,
  mockElectionManagerAuth,
  mockSystemAdministratorAuth,
  saveTmpFile,
} from '../test/app';
import {
  type ManualResultsIdentifier,
  type ManualResultsRecord,
} from '../types/types';

let mockNodeEnv: 'production' | 'test' = 'test';

beforeEach(() => {
  mockNodeEnv = 'test';
  jest.restoreAllMocks();
});

jest.setTimeout(20_000);

test('uses machine config from env', () => {
  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    VX_MACHINE_ID: 'test-machine-id',
    VX_CODE_VERSION: 'test-code-version',
  };

  const { api } = buildTestEnvironment();
  expect(api.getMachineConfig()).toEqual({
    machineId: 'test-machine-id',
    codeVersion: 'test-code-version',
  });

  process.env = originalEnv;
});

test('uses default machine config if not set', () => {
  const { api } = buildTestEnvironment();
  expect(api.getMachineConfig()).toEqual({
    machineId: '0000',
    codeVersion: 'dev',
  });
});

test('managing the current election', async () => {
  const { api, auth, logger } = buildTestEnvironment();

  mockSystemAdministratorAuth(auth);

  expect(api.getCurrentElectionMetadata()).toBeNull();

  // try configuring with a malformed election package
  const badConfigureResult = await api.configure({
    electionFilePath: saveTmpFile('{}'),
  });
  assert(badConfigureResult.isErr());
  expect(badConfigureResult.err().type).toEqual('invalid-zip');
  expect(logger.logAsCurrentRole).toHaveBeenNthCalledWith(
    1,
    LogEventId.ElectionConfigured,
    expect.objectContaining({
      disposition: 'failure',
    })
  );

  // try configuring with malformed election data
  const badElectionPackage = await zipFile({
    [ElectionPackageFileName.ELECTION]: '{}',
  });
  const badElectionConfigureResult = await api.configure({
    electionFilePath: saveTmpFile(badElectionPackage),
  });
  assert(badElectionConfigureResult.isErr());
  expect(badElectionConfigureResult.err().type).toEqual('invalid-election');

  expect(logger.logAsCurrentRole).toHaveBeenNthCalledWith(
    2,
    LogEventId.ElectionConfigured,
    expect.objectContaining({
      disposition: 'failure',
    })
  );

  const electionDefinition = electionTwoPartyPrimary.toElectionDefinition();
  const { ballotHash } = electionDefinition;

  const badSystemSettingsPackage = await zipFile({
    [ElectionPackageFileName.ELECTION]: electionDefinition.electionData,
    [ElectionPackageFileName.SYSTEM_SETTINGS]: '{}',
  });
  // try configuring with malformed system settings data
  const badSystemSettingsConfigureResult = await api.configure({
    electionFilePath: saveTmpFile(badSystemSettingsPackage),
  });
  assert(badSystemSettingsConfigureResult.isErr());
  expect(badSystemSettingsConfigureResult.err().type).toEqual(
    'invalid-system-settings'
  );
  expect(logger.logAsCurrentRole).toHaveBeenNthCalledWith(
    3,
    LogEventId.ElectionConfigured,
    expect.objectContaining({
      disposition: 'failure',
    })
  );

  // configure with well-formed data
  const goodPackage = await zipFile({
    [ElectionPackageFileName.ELECTION]: electionDefinition.electionData,
    [ElectionPackageFileName.SYSTEM_SETTINGS]: JSON.stringify(
      DEFAULT_SYSTEM_SETTINGS
    ),
  });
  const configureResult = await api.configure({
    electionFilePath: saveTmpFile(goodPackage),
  });
  assert(configureResult.isOk());
  const { electionId } = configureResult.ok();
  expect(logger.logAsCurrentRole).toHaveBeenNthCalledWith(
    4,
    LogEventId.ElectionConfigured,
    {
      disposition: 'success',
      newBallotHash: ballotHash,
    }
  );

  expect(api.getCurrentElectionMetadata()).toMatchObject({
    isOfficialResults: false,
    id: electionId,
    electionDefinition,
  });

  // mark results as official as election manager
  mockElectionManagerAuth(auth, electionDefinition.election);
  api.markResultsOfficial();
  expect(logger.logAsCurrentRole).toHaveBeenNthCalledWith(
    5,
    LogEventId.MarkedTallyResultsOfficial,
    expect.objectContaining({
      disposition: 'success',
    })
  );
  expect(api.getCurrentElectionMetadata()).toMatchObject({
    isOfficialResults: true,
    id: electionId,
    electionDefinition,
  });

  // unconfigure as system administrator
  mockSystemAdministratorAuth(auth);
  api.unconfigure();
  expect(logger.logAsCurrentRole).toHaveBeenNthCalledWith(
    6,
    LogEventId.ElectionUnconfigured,
    expect.objectContaining({
      disposition: 'success',
    })
  );
  expect(api.getCurrentElectionMetadata()).toBeNull();

  // confirm we can reconfigure on same app instance
  await configureMachine(api, auth, electionDefinition);
  expect(api.getCurrentElectionMetadata()).toMatchObject({
    isOfficialResults: false,
    electionDefinition,
  });
});

test('configuring with an election.json file', async () => {
  const { api, auth } = buildTestEnvironment();

  mockSystemAdministratorAuth(auth);

  const electionDefinition = electionGeneral.toElectionDefinition();
  const configureResult = await api.configure({
    electionFilePath: saveTmpFile(electionDefinition.electionData, '.json'),
  });
  expect(configureResult).toEqual(ok(expect.anything()));

  const badConfigureResult = await api.configure({
    electionFilePath: saveTmpFile('bad json file', '.json'),
  });
  expect(badConfigureResult).toMatchObject(err({ type: 'invalid-election' }));
});

test('configuring with a CDF election', async () => {
  const { api, auth, logger } = buildTestEnvironment();

  mockSystemAdministratorAuth(auth);

  const { electionData, ballotHash } = safeParseElectionDefinition(
    JSON.stringify(
      convertVxfElectionToCdfBallotDefinition(electionGeneral.election)
    )
  ).unsafeUnwrap();
  const electionPackage = await zipFile({
    [ElectionPackageFileName.ELECTION]: electionData,
  });

  // configure with well-formed election data
  const configureResult = await api.configure({
    electionFilePath: saveTmpFile(electionPackage),
  });
  assert(configureResult.isOk());
  configureResult.ok();
  expect(logger.logAsCurrentRole).toHaveBeenNthCalledWith(
    1,
    LogEventId.ElectionConfigured,
    {
      disposition: 'success',
      newBallotHash: ballotHash,
    }
  );

  const currentElectionMetadata = api.getCurrentElectionMetadata();
  expect(currentElectionMetadata?.electionDefinition.electionData).toEqual(
    electionData
  );
  expect(currentElectionMetadata?.electionDefinition.ballotHash).toEqual(
    ballotHash
  );

  // Ensure loading auth election key from db works
  mockElectionManagerAuth(auth, electionGeneral.election);
  expect(await api.getAuthStatus()).toMatchObject({
    status: 'logged_in',
  });
});

test('configuring with an election not from removable media in prod errs', async () => {
  const { api, auth } = buildTestEnvironment();
  mockNodeEnv = 'production';

  mockSystemAdministratorAuth(auth);

  await suppressingConsoleOutput(
    async () =>
      await expect(() =>
        api.configure({
          electionFilePath: '/media/../tmp/nope',
        })
      ).rejects.toThrow(
        'Can only import election packages from removable media in production'
      )
  );
});

test('getSystemSettings happy path', async () => {
  const { api, auth } = buildTestEnvironment();

  const { systemSettings } = electionTwoPartyPrimaryFixtures;
  const electionDefinition = electionTwoPartyPrimary.toElectionDefinition();
  await configureMachine(
    api,
    auth,
    electionDefinition,
    JSON.parse(systemSettings.asText())
  );

  mockSystemAdministratorAuth(auth);

  const systemSettingsResult = api.getSystemSettings();
  assert(systemSettingsResult);
  expect(systemSettingsResult).toEqual(JSON.parse(systemSettings.asText()));
});

test('getSystemSettings returns default system settings when there is no current election', () => {
  const { api } = buildTestEnvironment();

  const systemSettingsResult = api.getSystemSettings();
  expect(systemSettingsResult).toEqual(DEFAULT_SYSTEM_SETTINGS);
});

test('listPotentialElectionPackagesOnUsbDrive', async () => {
  const { api, mockUsbDrive } = buildTestEnvironment();

  mockUsbDrive.removeUsbDrive();
  expect(await api.listPotentialElectionPackagesOnUsbDrive()).toEqual(
    err({ type: 'no-usb-drive' })
  );

  mockUsbDrive.insertUsbDrive({});
  expect(await api.listPotentialElectionPackagesOnUsbDrive()).toEqual(ok([]));

  const fileContents = Buffer.from('doesnt matter');
  mockUsbDrive.insertUsbDrive({
    'election-package-1.zip': fileContents,
    'some-other-file.txt': fileContents,
    'election-package-2.zip': fileContents,
    '_election-package-1.zip': fileContents,
    '._election-package-2.zip': fileContents,
    '.election-package-3.zip': fileContents,
  });
  expect(await api.listPotentialElectionPackagesOnUsbDrive()).toMatchObject(
    ok([
      {
        name: 'election-package-2.zip',
        path: expect.stringMatching(/\/election-package-2.zip/),
        ctime: expect.anything(),
      },
      {
        name: 'election-package-1.zip',
        path: expect.stringMatching(/\/election-package-1.zip/),
        ctime: expect.anything(),
      },
    ])
  );
});

test('saveElectionPackageToUsb', async () => {
  const { api, auth, mockUsbDrive } = buildTestEnvironment();
  const electionDefinition = electionTwoPartyPrimary.toElectionDefinition();
  await configureMachine(api, auth, electionDefinition);

  mockUsbDrive.insertUsbDrive({});
  mockUsbDrive.usbDrive.sync.expectRepeatedCallsWith().resolves();
  const response = await api.saveElectionPackageToUsb();
  expect(response).toEqual(ok());
});

test('saveElectionPackageToUsb when no USB drive', async () => {
  const { api, auth, mockUsbDrive } = buildTestEnvironment();
  const electionDefinition = electionTwoPartyPrimary.toElectionDefinition();
  await configureMachine(api, auth, electionDefinition);

  mockUsbDrive.usbDrive.status
    .expectCallWith()
    .resolves({ status: 'no_drive' });
  const response = await api.saveElectionPackageToUsb();
  expect(response).toEqual(
    err({ type: 'missing-usb-drive', message: 'No USB drive found' })
  );
});

test('usbDrive', async () => {
  const {
    api,
    auth,
    mockUsbDrive: { usbDrive },
  } = buildTestEnvironment();
  const electionDefinition = electionTwoPartyPrimary.toElectionDefinition();
  await configureMachine(api, auth, electionDefinition);

  mockSystemAdministratorAuth(auth);

  usbDrive.status.expectCallWith().resolves({ status: 'no_drive' });
  expect(await api.getUsbDriveStatus()).toEqual({
    status: 'no_drive',
  });

  usbDrive.status
    .expectCallWith()
    .resolves({ status: 'error', reason: 'bad_format' });
  expect(await api.getUsbDriveStatus()).toMatchObject({
    status: 'error',
    reason: 'bad_format',
  });

  usbDrive.eject.expectCallWith().resolves();
  await api.ejectUsbDrive();

  usbDrive.format.expectCallWith().resolves();
  (await api.formatUsbDrive()).assertOk('format failed');

  const error = new Error('format failed');
  usbDrive.format.expectCallWith().throws(error);
  expect(await api.formatUsbDrive()).toEqual(err(error));
});

test('printer status', async () => {
  const { mockPrinterHandler, api } = buildTestEnvironment();

  expect(await api.getPrinterStatus()).toEqual<PrinterStatus>({
    connected: false,
  });

  mockPrinterHandler.connectPrinter(HP_LASER_PRINTER_CONFIG);

  expect(await api.getPrinterStatus()).toEqual<PrinterStatus>(
    getMockConnectedPrinterStatus(HP_LASER_PRINTER_CONFIG)
  );

  mockPrinterHandler.disconnectPrinter();

  expect(await api.getPrinterStatus()).toEqual<PrinterStatus>({
    connected: false,
  });
});

describe('ERR file import', () => {
  test('success', async () => {
    const { api, auth } = buildTestEnvironment();
    await configureMachine(api, auth, electionGeneral.toElectionDefinition());
    const errContents = testElectionReport;
    const filepath = tmpNameSync();
    await writeFile(filepath, JSON.stringify(errContents));
    const manualResultsIdentifier: ManualResultsIdentifier = {
      precinctId: '21',
      ballotStyleGroupId: '12' as BallotStyleGroupId,
      votingMethod: 'precinct',
    };

    const result = await api.importElectionResultsReportingFile({
      ...manualResultsIdentifier,
      filepath,
    });

    expect(result.isOk()).toEqual(true);

    const manualResults = api.getManualResults(manualResultsIdentifier);
    const expected: ManualResultsRecord = {
      precinctId: '21',
      ballotStyleGroupId: '12' as BallotStyleGroupId,
      votingMethod: 'precinct',
      manualResults: {
        ballotCount: 65,
        contestResults: {
          fishing: {
            contestId: 'fishing',
            contestType: 'yesno',
            yesOptionId: 'fishing-yes',
            noOptionId: 'fishing-no',
            yesTally: 30,
            noTally: 29,
            overvotes: 1,
            undervotes: 5,
            ballots: 65,
          },
          judge: {
            contestId: 'judge',
            contestType: 'yesno',
            yesOptionId: 'retain-yes',
            noOptionId: 'retain-no',
            yesTally: 55,
            noTally: 10,
            overvotes: 0,
            undervotes: 0,
            ballots: 65,
          },
          council: {
            contestId: 'council',
            contestType: 'candidate',
            votesAllowed: 2,
            overvotes: 8,
            undervotes: 2,
            ballots: 65,
            tallies: {
              'barchi-hallaren': {
                id: 'barchi-hallaren',
                name: 'Joseph Barchi and Joseph Hallaren',
                tally: 60,
              },
              'cramer-vuocolo': {
                id: 'cramer-vuocolo',
                name: 'Adam Cramer and Greg Vuocolo',
                tally: 30,
              },
              'court-blumhardt': {
                id: 'court-blumhardt',
                name: 'Daniel Court and Amy Blumhardt',
                tally: 30,
              },
            },
          },
        },
      },
      createdAt: expect.any(String),
    };

    expect(manualResults).toEqual(expected);
  });

  test('logs when file parsing fails', async () => {
    const { api, auth } = buildTestEnvironment();
    await configureMachine(api, auth, electionGeneral.toElectionDefinition());
    const errContents = 'not json';
    const filepath = tmpNameSync();
    await writeFile(filepath, JSON.stringify(errContents));
    const manualResultsIdentifier: ManualResultsIdentifier = {
      precinctId: '21',
      ballotStyleGroupId: '12' as BallotStyleGroupId,
      votingMethod: 'precinct',
    };

    const result = await api.importElectionResultsReportingFile({
      ...manualResultsIdentifier,
      filepath,
    });
    expect(result.err()?.type).toEqual('parsing-failed');
  });

  test('rejects when conversion to VX tabulation format fails', async () => {
    const { api, auth } = buildTestEnvironment();
    await configureMachine(api, auth, electionGeneral.toElectionDefinition());
    const errContents = testElectionReportUnsupportedContestType;
    const filepath = tmpNameSync();
    await writeFile(filepath, JSON.stringify(errContents));
    const manualResultsIdentifier: ManualResultsIdentifier = {
      precinctId: assertDefined(electionGeneral.election.precincts[0]).id,
      ballotStyleGroupId: assertDefined(
        electionGeneral.election.ballotStyles[0]
      ).groupId,
      votingMethod: 'precinct',
    };

    const result = await api.importElectionResultsReportingFile({
      ...manualResultsIdentifier,
      filepath,
    });
    expect(result.err()?.type).toEqual('conversion-failed');
  });
});
