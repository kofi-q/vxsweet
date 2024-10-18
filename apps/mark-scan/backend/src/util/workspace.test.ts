jest.mock(
  '@vx/libs/backend/src',
  (): typeof import('@vx/libs/backend/src') => ({
    ...jest.requireActual('@vx/libs/backend/src'),
    initializeGetWorkspaceDiskSpaceSummary: jest.fn(),
  })
);

import { dirSync } from 'tmp';
import { mockOf } from '@vx/libs/test-utils/src';
import { initializeGetWorkspaceDiskSpaceSummary } from '@vx/libs/backend/src';
import { mockBaseLogger } from '@vx/libs/logging/src';
import { createWorkspace } from './workspace';

const initializeGetWorkspaceDiskSpaceSummaryMock = mockOf(
  initializeGetWorkspaceDiskSpaceSummary
);

test('workspace.reset rests the store', () => {
  const workspace = createWorkspace(dirSync().name, mockBaseLogger());
  const fn = jest.fn();
  workspace.store.reset = fn;
  workspace.reset();
  expect(fn).toHaveBeenCalledTimes(1);
});

test('disk space tracking setup', () => {
  const dir = dirSync();
  const getWorkspaceDiskSpaceSummary = jest.fn();
  initializeGetWorkspaceDiskSpaceSummaryMock.mockReturnValueOnce(
    getWorkspaceDiskSpaceSummary
  );
  const workspace = createWorkspace(dir.name, mockBaseLogger());
  expect(initializeGetWorkspaceDiskSpaceSummaryMock).toHaveBeenCalledTimes(1);
  expect(initializeGetWorkspaceDiskSpaceSummaryMock).toHaveBeenCalledWith(
    workspace.store,
    [workspace.path]
  );
  expect(workspace.getDiskSpaceSummary).toEqual(getWorkspaceDiskSpaceSummary);
});
