jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag: BooleanEnvironmentVariableName) =>
      featureFlagMock.isEnabled(flag),
  };
});

jest.mock(
  '@vx/libs/backend/audio',
  (): typeof import('@vx/libs/backend/audio') => {
    return {
      ...jest.requireActual('@vx/libs/backend/audio'),
      initializeSystemAudio: jest.fn(),
    };
  }
);

import { LogEventId, mockBaseLogger, mockLogger } from '@vx/libs/logging/src';
import tmp from 'tmp';
import { buildMockInsertedSmartCardAuth } from '@vx/libs/auth/test-utils';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import { MockPaperHandlerDriver } from '@vx/libs/custom-paper-handler/src/driver';
import { initializeSystemAudio } from '@vx/libs/backend/audio';
import { testDetectDevices } from '@vx/libs/backend/devices';
import { mockOf } from '@vx/libs/test-utils/src';
import { PORT } from '../globals/globals';
import { resolveDriver, start } from './server';
import { createWorkspace } from '../util/workspace';

const featureFlagMock = getFeatureFlagMock();

afterEach(() => {
  featureFlagMock.resetFeatureFlags();
});

test('can start server', async () => {
  const auth = buildMockInsertedSmartCardAuth();
  const logger = mockLogger();
  const workspace = createWorkspace(tmp.dirSync().name, mockBaseLogger());

  const server = await start({
    auth,
    logger,
    port: PORT,
    workspace,
  });
  expect(server.listening).toBeTruthy();
  expect(mockOf(initializeSystemAudio)).toHaveBeenCalled();
  server.close();
  workspace.reset();
});

test('can start without providing auth', async () => {
  featureFlagMock.enableFeatureFlag(
    BooleanEnvironmentVariableName.USE_MOCK_CARDS
  );

  const logger = mockLogger();
  const workspace = createWorkspace(tmp.dirSync().name, mockBaseLogger());

  const server = await start({
    logger,
    port: PORT,
    workspace,
  });
  expect(server.listening).toBeTruthy();
  server.close();
  workspace.reset();
});

test('logs device attach/un-attach events', async () => {
  featureFlagMock.enableFeatureFlag(
    BooleanEnvironmentVariableName.USE_MOCK_CARDS
  );
  const logger = mockLogger();
  const workspace = createWorkspace(tmp.dirSync().name, mockBaseLogger());

  const server = await start({
    logger,
    port: PORT,
    workspace,
  });

  testDetectDevices(logger);

  server.close();
  workspace.reset();
});

test('resolveDriver returns a mock driver if feature flag is on', async () => {
  featureFlagMock.enableFeatureFlag(
    BooleanEnvironmentVariableName.USE_MOCK_PAPER_HANDLER
  );
  const logger = mockLogger();

  const driver = await resolveDriver(logger);
  expect(driver).toBeInstanceOf(MockPaperHandlerDriver);
  expect(logger.log).toHaveBeenCalledWith(
    LogEventId.PaperHandlerConnection,
    'system',
    {
      message: 'Starting server with mock paper handler',
    }
  );
});
