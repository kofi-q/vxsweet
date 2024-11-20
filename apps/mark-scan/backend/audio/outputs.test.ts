jest.mock('@votingworks/backend');

jest.mock('../globals');

jest.mock(
  '@vx/libs/basics/async',
  (): typeof import('@vx/libs/basics/async') => ({
    ...jest.requireActual('@vx/libs/basics/async'),
    sleep: jest.fn(),
  })
);

import { mockOf } from '@vx/libs/test-utils/src';
import {
  AudioOutput,
  MAX_PULSE_COMMAND_ATTEMPTS,
  setAudioOutput,
} from './outputs';
import { execFile } from '@vx/libs/backend/command_line';
import { sleep } from '@vx/libs/basics/async';
import { LogEventId, mockLogger } from '@vx/libs/logging/src';
import { getNodeEnv } from '../globals/globals';

const mockExecFile = mockOf(execFile);
const mockSleep = mockOf(sleep);
const mockGetNodeEnv = mockOf(getNodeEnv);
const mockLog = mockLogger();

test('setAudioOutput - success on retry', async () => {
  mockGetNodeEnv.mockReturnValue('production');
  mockSleep.mockResolvedValue();
  mockExecFile.mockRejectedValueOnce('command failed');
  mockExecFile.mockResolvedValueOnce({ stdout: 'ok', stderr: '' });

  await setAudioOutput(AudioOutput.SPEAKER, mockLog);

  expect(mockExecFile).toHaveBeenCalledTimes(2);
  expect(mockSleep).toHaveBeenCalledTimes(1);
  expect(mockLog.log).toHaveBeenCalledTimes(1);
  expect(mockLog.log).toHaveBeenCalledWith(
    LogEventId.Info,
    'system',
    expect.objectContaining({
      message: expect.stringContaining('command failed'),
    })
  );
});

test('setAudioOutput - retries and rethrows on failure', async () => {
  mockGetNodeEnv.mockReturnValue('production');
  mockSleep.mockResolvedValue();
  mockExecFile.mockRejectedValue('command failed');

  await expect(() =>
    setAudioOutput(AudioOutput.SPEAKER, mockLog)
  ).rejects.toMatchObject({
    message: /command failed/,
  });

  expect(mockExecFile).toHaveBeenCalledTimes(MAX_PULSE_COMMAND_ATTEMPTS);
  expect(mockSleep).toHaveBeenCalledTimes(MAX_PULSE_COMMAND_ATTEMPTS - 1);
  expect(mockLog.log).toHaveBeenCalledTimes(MAX_PULSE_COMMAND_ATTEMPTS - 1);
});

test('setAudioOutput - no-op in non-prod environments', async () => {
  mockGetNodeEnv.mockReturnValue('development');

  await setAudioOutput(AudioOutput.SPEAKER, mockLog);

  expect(mockExecFile).not.toHaveBeenCalled();
  expect(mockSleep).not.toHaveBeenCalled();
  expect(mockLog.log).not.toHaveBeenCalled();
});
