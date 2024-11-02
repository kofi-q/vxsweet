import tmp from 'tmp';

import { buildMockInsertedSmartCardAuth } from '@vx/libs/auth/src';
import { createMockUsbDrive } from '@vx/libs/usb-drive/src';
import { typedAs } from '@vx/libs/basics/src';

import { mockBaseLogger } from '@vx/libs/logging/src';
import { Store } from '../store/store';
import { createWorkspace } from '../util/workspace';
import { buildApi } from './app';
import { buildMockLogger } from '../test/app_helpers';
import { type PaperHandlerStateMachine } from '../custom-paper-handler/state_machine';

function getMockStateMachine() {
  return typedAs<Partial<PaperHandlerStateMachine>>({
    startSessionWithPreprintedBallot: jest.fn(),
    returnPreprintedBallot: jest.fn(),
  }) as unknown as jest.Mocked<PaperHandlerStateMachine>;
}

function buildTestApi() {
  const store = Store.memoryStore();
  const workspace = createWorkspace(tmp.dirSync().name, mockBaseLogger(), {
    store,
  });
  const mockAuth = buildMockInsertedSmartCardAuth();
  const mockStateMachine = getMockStateMachine();

  const api = buildApi(
    mockAuth,
    createMockUsbDrive().usbDrive,
    buildMockLogger(mockAuth, workspace),
    workspace,
    mockStateMachine
  );

  return { api, mockStateMachine };
}

test('startSessionWithPreprintedBallot', () => {
  const { api, mockStateMachine } = buildTestApi();

  api.startSessionWithPreprintedBallot();
  expect(mockStateMachine.startSessionWithPreprintedBallot).toHaveBeenCalled();
});

test('returnPreprintedBallot', () => {
  const { api, mockStateMachine } = buildTestApi();

  api.returnPreprintedBallot();
  expect(mockStateMachine.returnPreprintedBallot).toHaveBeenCalled();
});
