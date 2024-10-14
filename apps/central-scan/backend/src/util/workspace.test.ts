import { initializeGetWorkspaceDiskSpaceSummary } from '@vx/libs/backend/src';
import { mockOf } from '@vx/libs/test-utils/src';
import tmp from 'tmp';
import { mockBaseLogger } from '@vx/libs/logging/src';
import { createWorkspace } from './workspace';

jest.mock(
  '@vx/libs/backend/src',
  (): typeof import('@vx/libs/backend/src') => ({
    ...jest.requireActual('@vx/libs/backend/src'),
    initializeGetWorkspaceDiskSpaceSummary: jest.fn(),
  })
);

const initializeGetWorkspaceDiskSpaceSummaryMock = mockOf(
  initializeGetWorkspaceDiskSpaceSummary
);

test('disk space tracking setup', () => {
  const dir = tmp.dirSync();
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
