jest.mock(
  '@vx/libs/backend/audio',
  (): typeof import('@vx/libs/backend/audio') => {
    return {
      ...jest.requireActual('@vx/libs/backend/audio'),
      initializeSystemAudio: jest.fn(),
    };
  }
);

import { mockBaseLogger } from '@vx/libs/logging/src';
import tmp from 'tmp';
import { buildMockInsertedSmartCardAuth } from '@vx/libs/auth/test-utils';
import { mockOf } from '@vx/libs/test-utils/src';
import { initializeSystemAudio } from '@vx/libs/backend/audio';
import { PORT } from '../globals/globals';
import { start } from './server';
import { createWorkspace } from '../workspace/workspace';

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
