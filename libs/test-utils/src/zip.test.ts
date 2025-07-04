import { sleep } from '@vx/libs/basics/async';
import { zipFile } from './zip';

test('zipFile is deterministic across runs', async () => {
  const contents = {
    'file1.txt': 'file1 contents',
    'file2.txt': 'file2 contents',
  } as const;
  const zip1 = await zipFile(contents);
  await sleep(500);
  const zip2 = await zipFile(contents);
  expect(zip1).toEqual(zip2);
});
