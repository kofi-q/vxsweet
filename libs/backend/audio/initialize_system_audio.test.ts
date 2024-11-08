jest.mock(
  '../command_line/exec',
  (): typeof import('../command_line/exec') => ({
    ...jest.requireActual('../command_line/exec'),
    execFile: jest.fn(),
  })
);

import { mockOf } from '@vx/libs/test-utils/src';

import { execFile } from '../command_line/exec';
import { initializeSystemAudio } from './initialize_system_audio';

const execFileMock = mockOf(execFile);

test('sets system volume to 100%', async () => {
  execFileMock.mockResolvedValue({ stdout: '', stderr: '' });

  await initializeSystemAudio();

  expect(execFileMock).toHaveBeenCalledWith(
    'amixer',
    expect.arrayContaining(['sset', 'Master', '100%', 'unmute'])
  );
});
