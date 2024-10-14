import { mockBaseLogger } from '@vx/libs/logging/src';
import tmp from 'tmp';
import { buildMockInsertedSmartCardAuth } from '@vx/libs/auth/src';
import { mockOf } from '@vx/libs/test-utils/src';
import { initializeSystemAudio } from '@vx/libs/backend/src';
import { PORT } from './globals';
import { start } from './server';
import { createWorkspace } from './util/workspace';

jest.mock('@vx/libs/backend/src', (): typeof import('@vx/libs/backend/src') => {
  return {
    ...jest.requireActual('@vx/libs/backend/src'),
    initializeSystemAudio: jest.fn(),
  };
});

test('can start server', async () => {
  const auth = buildMockInsertedSmartCardAuth();
  const baseLogger = mockBaseLogger();
  const workspace = createWorkspace(tmp.dirSync().name, mockBaseLogger());

  const server = await start({
    auth,
    baseLogger,
    port: PORT,
    workspace,
  });
  expect(server.listening).toBeTruthy();
  expect(mockOf(initializeSystemAudio)).toHaveBeenCalled();
  server.close();
});
