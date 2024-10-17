jest.mock('./exec', (): typeof import('./exec') => ({
  ...jest.requireActual('./exec'),
  execFile: jest.fn(),
}));

import { mockOf } from '@vx/libs/test-utils/src';

import { execFile } from './exec';
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
