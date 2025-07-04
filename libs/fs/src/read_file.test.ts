import { Buffer } from 'node:buffer';
import { writeFileSync } from 'node:fs';
import { err, ok } from '@vx/libs/basics/result';
import { typedAs } from '@vx/libs/basics/types';
import fc from 'fast-check';
import { type ReadFileError, readFile } from './read_file';
import { makeTmpFile } from '../test/utils';

test('file open error', async () => {
  const path = makeTmpFile();
  expect(await readFile(path, { maxSize: 1024 })).toEqual(
    err(
      typedAs<ReadFileError>({
        type: 'OpenFileError',
        error: expect.objectContaining({ code: 'ENOENT' }),
      })
    )
  );
});

test('file exceeds max size', async () => {
  const path = makeTmpFile();
  const maxSize = 10;
  writeFileSync(path, 'a'.repeat(maxSize + 1));
  expect(await readFile(path, { maxSize })).toEqual(
    err(
      typedAs<ReadFileError>({
        type: 'FileExceedsMaxSize',
        maxSize,
        fileSize: maxSize + 1,
      })
    )
  );
});

test('invalid maxSize', async () => {
  await expect(readFile('path', { maxSize: -1 })).rejects.toThrow(
    'maxSize must be non-negative'
  );
});

test('success', async () => {
  {
    const path = makeTmpFile();
    const contents = 'file contents';

    writeFileSync(path, contents);

    const buffer = (await readFile(path, { maxSize: 1024 })).unsafeUnwrap();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.toString('utf-8')).toEqual(contents);

    expect(await readFile(path, { maxSize: 1024, encoding: 'utf-8' })).toEqual(
      ok(contents)
    );
  }

  await fc.assert(
    fc.asyncProperty(fc.uint8Array(), async (contents) => {
      const path = makeTmpFile();
      writeFileSync(path, contents);
      expect(
        await readFile(path, {
          maxSize: contents.byteLength,
        })
      ).toEqual(ok(Buffer.from(contents)));
    })
  );
});
