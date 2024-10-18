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
import {
  constructElectionKey,
  safeParseElectionDefinition,
  testCdfBallotDefinition,
} from '@vx/libs/types/src';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';

import {
  mockElectionManagerUser,
  mockSessionExpiresAt,
} from '@vx/libs/test-utils/src';
import { MockUsbDrive, createMockUsbDrive } from '@vx/libs/usb-drive/src';
import { createMockPrinterHandler } from '@vx/libs/printing/src';
import { mockBaseLogger } from '@vx/libs/logging/src';
import { Store } from './store';
import { createWorkspace } from './util/workspace';
import { Api, buildApi } from './app';
import { buildMockLogger } from '../test/app_helpers';

const mockFeatureFlagger = getFeatureFlagMock();

const store = Store.memoryStore();
const workspace = createWorkspace(tmp.dirSync().name, mockBaseLogger(), {
  store,
});
const mockAuth = buildMockInsertedSmartCardAuth();
const electionDefinition = safeParseElectionDefinition(
  JSON.stringify(testCdfBallotDefinition)
).unsafeUnwrap();

afterEach(() => {
  workspace.reset();
});

runUiStringApiTests({
  api: buildApi(
    mockAuth,
    createMockUsbDrive().usbDrive,
    createMockPrinterHandler().printer,
    buildMockLogger(mockAuth, workspace),
    workspace
  ),
  store: store.getUiStringsStore(),
});

describe('configureElectionPackageFromUsb', () => {
  let mockUsbDrive: MockUsbDrive;
  let api: Api;

  beforeEach(() => {
    mockFeatureFlagger.resetFeatureFlags();
    mockFeatureFlagger.enableFeatureFlag(
      BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
    );

    mockUsbDrive = createMockUsbDrive();
    api = buildApi(
      mockAuth,
      mockUsbDrive.usbDrive,
      createMockPrinterHandler().printer,
      buildMockLogger(mockAuth, workspace),
      workspace
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

  runUiStringMachineConfigurationTests({
    electionDefinition,
    getMockUsbDrive: () => mockUsbDrive,
    runConfigureMachine: () => api.configureElectionPackageFromUsb(),
    store: store.getUiStringsStore(),
  });
});

describe('unconfigureMachine', () => {
  const api = buildApi(
    mockAuth,
    createMockUsbDrive().usbDrive,
    createMockPrinterHandler().printer,
    buildMockLogger(mockAuth, workspace),
    workspace
  );

  runUiStringMachineDeconfigurationTests({
    runUnconfigureMachine: () => api.unconfigureMachine(),
    store: store.getUiStringsStore(),
  });
});
