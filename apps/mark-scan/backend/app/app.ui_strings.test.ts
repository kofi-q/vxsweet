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
} from '@vx/libs/backend/ui_strings';
import { buildMockInsertedSmartCardAuth } from '@vx/libs/auth/test-utils';
import { safeParseElectionDefinition } from '@vx/libs/types/election-parsing';
import { testCdfBallotDefinition } from '@vx/libs/types/cdf';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import { type MockUsbDrive, createMockUsbDrive } from '@vx/libs/usb-drive/src';
import { mockBaseLogger } from '@vx/libs/logging/src';
import { Store } from '../store/store';
import { createWorkspace } from '../util/workspace';
import { type Api, buildApi } from './app';
import { buildMockLogger } from '../test/app_helpers';
import { mockElectionManagerAuth } from '../test/auth_helpers';

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
      buildMockLogger(mockAuth, workspace),
      workspace
    );

    mockElectionManagerAuth(mockAuth, electionDefinition);
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
    buildMockLogger(mockAuth, workspace),
    workspace
  );

  runUiStringMachineDeconfigurationTests({
    runUnconfigureMachine: () => api.unconfigureMachine(),
    store: store.getUiStringsStore(),
  });
});
