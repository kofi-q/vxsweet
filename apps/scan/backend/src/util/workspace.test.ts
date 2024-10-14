import * as tmp from 'tmp';
import { mockOf } from '@vx/libs/test-utils/src';
import { initializeGetWorkspaceDiskSpaceSummary } from '@vx/libs/backend/src';
import { mockBaseLogger } from '@vx/libs/logging/src';
import { createWorkspace } from './workspace';
import { Store } from '../store';

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

test('createWorkspace', () => {
  const dir = tmp.dirSync();
  const workspace = createWorkspace(dir.name, mockBaseLogger());
  expect(workspace.path).toEqual(dir.name);
  expect(workspace.store).toBeInstanceOf(Store);
});

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
