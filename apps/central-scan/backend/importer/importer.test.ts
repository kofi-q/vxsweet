import { dirSync } from 'tmp';
import { mockBaseLogger, mockLogger } from '@vx/libs/logging/src';
import { createImageData } from 'canvas';
import { Importer } from './importer';
import { createWorkspace } from '../workspace/workspace';
import { makeMockScanner } from '../test/util/mocks';

test('no election is configured', async () => {
  const workspace = createWorkspace(dirSync().name, mockBaseLogger());
  const scanner = makeMockScanner();
  const importer = new Importer({
    workspace,
    scanner,
    logger: mockLogger(),
  });

  await expect(importer.startImport()).rejects.toThrowError(
    'no election configuration'
  );

  await expect(
    importer.importSheet(
      'batch-1',
      createImageData(1, 1),
      createImageData(1, 1)
    )
  ).rejects.toThrowError('no election configuration');
});
