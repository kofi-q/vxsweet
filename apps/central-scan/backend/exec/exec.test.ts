jest.mock('node:child_process');

import { execFile } from 'node:child_process';
import { streamExecFile } from './exec';

test('streamExecFile wrapper calls execFile', () => {
  streamExecFile('ls', []);
  expect(execFile).toHaveBeenCalled();
});
