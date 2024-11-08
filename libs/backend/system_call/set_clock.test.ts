jest.mock(
  '../command_line/exec',
  (): typeof import('../command_line/exec') => ({
    ...jest.requireActual('../command_line/exec'),
    execFile: jest.fn(),
  })
);

/* eslint-disable prefer-regex-literals */

import { mockOf } from '@vx/libs/test-utils/src';
import { setClock } from './set_clock';
import { execFile } from '../command_line/exec';

const execMock = mockOf(execFile);

test('setClock works in daylights savings', async () => {
  await setClock({
    isoDatetime: '2020-10-03T15:00Z',
    ianaZone: 'America/Chicago',
  });

  expect(execMock).toHaveBeenNthCalledWith(1, 'sudo', [
    expect.stringMatching(
      new RegExp('^/.*/libs/backend/src/intermediate-scripts/set-clock$')
    ),
    'America/Chicago',
    '2020-10-03 10:00:00',
  ]);
});

test('setClock works in non-daylights savings', async () => {
  await setClock({
    isoDatetime: '2020-11-03T15:00Z',
    ianaZone: 'America/Chicago',
  });

  expect(execMock).toHaveBeenNthCalledWith(1, 'sudo', [
    expect.stringMatching(
      new RegExp('^/.*/libs/backend/src/intermediate-scripts/set-clock$')
    ),
    'America/Chicago',
    '2020-11-03 09:00:00',
  ]);
});

test('setClock bubbles up errors', async () => {
  // standard error is through
  execMock.mockRejectedValueOnce(
    new Error('Failed to set time: Automatic time synchronization is enabled')
  );

  await expect(
    setClock({
      isoDatetime: '2020-11-03T15:00Z',
      ianaZone: 'America/Chicago',
    })
  ).rejects.toThrowError(
    'Failed to set time: Automatic time synchronization is enabled'
  );

  // error text is in stderr
  execMock.mockRejectedValueOnce({
    stderr: 'Failed to set time: Automatic time synchronization is enabled',
  });

  await expect(
    setClock({
      isoDatetime: '2020-11-03T15:00Z',
      ianaZone: 'America/Chicago',
    })
  ).rejects.toThrowError(
    'Failed to set time: Automatic time synchronization is enabled'
  );
});
