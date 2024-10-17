jest.mock('../utils/exec');

import { ok } from '@vx/libs/basics/src';
import { mockOf } from '@vx/libs/test-utils/src';
import { BROTHER_THERMAL_PRINTER_CONFIG, getPpdPath } from '.';
import { exec } from '../utils/exec';
import { DEFAULT_MANAGED_PRINTER_NAME, configurePrinter } from './configure';


const execMock = mockOf(exec);

beforeEach(() => {
  execMock.mockImplementation(() => {
    throw new Error('not implemented');
  });
});

test('calls lpadmin with expected args', async () => {
  execMock.mockResolvedValueOnce(
    ok({
      stdout: '',
      stderr: '',
    })
  );

  const uri = 'usb://Make/Model';
  const config = BROTHER_THERMAL_PRINTER_CONFIG;
  await configurePrinter({
    uri,
    config,
  });
  expect(execMock).toHaveBeenCalledWith('lpadmin', [
    '-p',
    DEFAULT_MANAGED_PRINTER_NAME,
    '-v',
    uri,
    '-P',
    getPpdPath(config),
    '-E',
  ]);
});
