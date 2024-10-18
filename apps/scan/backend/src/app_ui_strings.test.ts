jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
  };
});

import tmp from 'tmp';

import {
  runUiStringApiTests,
  runUiStringMachineConfigurationTests,
  runUiStringMachineDeconfigurationTests,
} from '@vx/libs/backend/src';
import { buildMockInsertedSmartCardAuth } from '@vx/libs/auth/src';
import { createMockUsbDrive } from '@vx/libs/usb-drive/src';

import {
  mockElectionManagerUser,
  mockSessionExpiresAt,
} from '@vx/libs/test-utils/src';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import {
  constructElectionKey,
  safeParseElectionDefinition,
  testCdfBallotDefinition,
} from '@vx/libs/types/src';
import { createMockPrinterHandler } from '@vx/libs/printing/src';
import { mockBaseLogger } from '@vx/libs/logging/src';
import { Store } from './store';
import { buildApi } from './app';
import { createWorkspace } from './util/workspace';
import { wrapLegacyPrinter } from './printing/printer';
import {
  buildMockLogger,
  createPrecinctScannerStateMachineMock,
} from '../test/helpers/shared_helpers';

const mockFeatureFlagger = getFeatureFlagMock();

const store = Store.memoryStore();
const workspace = createWorkspace(tmp.dirSync().name, mockBaseLogger(), {
  store,
});
const mockUsbDrive = createMockUsbDrive();
const { printer } = createMockPrinterHandler();
const mockAuth = buildMockInsertedSmartCardAuth();
const electionDefinition = safeParseElectionDefinition(
  JSON.stringify(testCdfBallotDefinition)
).unsafeUnwrap();

afterEach(() => {
  workspace.reset();
});

runUiStringApiTests({
  api: buildApi({
    auth: mockAuth,
    machine: createPrecinctScannerStateMachineMock(),
    workspace,
    usbDrive: mockUsbDrive.usbDrive,
    printer: wrapLegacyPrinter(printer),
    logger: buildMockLogger(mockAuth, workspace),
  }),
  store: store.getUiStringsStore(),
});

describe('configureFromElectionPackageOnUsbDrive', () => {
  beforeEach(() => {
    mockFeatureFlagger.resetFeatureFlags();
    mockFeatureFlagger.enableFeatureFlag(
      BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
    );

    mockAuth.getAuthStatus.mockImplementation(() =>
      Promise.resolve({
        status: 'logged_in',
        user: mockElectionManagerUser({
          electionKey: constructElectionKey(electionDefinition.election),
        }),
        sessionExpiresAt: mockSessionExpiresAt(),
      })
    );
  });

  const api = buildApi({
    auth: mockAuth,
    machine: createPrecinctScannerStateMachineMock(),
    workspace,
    usbDrive: mockUsbDrive.usbDrive,
    printer: wrapLegacyPrinter(printer),
    logger: buildMockLogger(mockAuth, workspace),
  });

  runUiStringMachineConfigurationTests({
    electionDefinition,
    getMockUsbDrive: () => mockUsbDrive,
    runConfigureMachine: () => api.configureFromElectionPackageOnUsbDrive(),
    store: store.getUiStringsStore(),
  });
});

describe('unconfigureElection', () => {
  const api = buildApi({
    auth: mockAuth,
    machine: createPrecinctScannerStateMachineMock(),
    workspace,
    usbDrive: mockUsbDrive.usbDrive,
    printer: wrapLegacyPrinter(printer),
    logger: buildMockLogger(mockAuth, workspace),
  });

  runUiStringMachineDeconfigurationTests({
    runUnconfigureMachine: () => api.unconfigureElection(),
    store: store.getUiStringsStore(),
  });
});
