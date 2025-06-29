import { type Result, err, ok } from '@vx/libs/basics/result';
import { assert } from '@vx/libs/basics/assert';
import { Dirent, promises as fs } from 'node:fs';
import { isAbsolute, join } from 'node:path';

/**
 * Types of file system entities defined in `libuv`. We omit only `Unknown`,
 * which we handle as an error.
 */
export enum FileSystemEntryType {
  File = 1, // UV_DIRENT_FILE
  Directory = 2, // UV_DIRENT_DIR
  SymbolicLink = 3, // UV_DIRENT_LINK
  FIFO = 4, // UV_DIRENT_FIFO
  Socket = 5, // UV_DIRENT_SOCKET
  CharacterDevice = 6, // UV_DIRENT_CHAR
  BlockDevice = 7, // UV_DIRENT_BLOCK
}

/**
 * Information about a file system entry found in a directory.
 */
export interface FileSystemEntry {
  readonly name: string;
  readonly path: string;
  readonly type: FileSystemEntryType;
  readonly size: number;
  readonly mtime: Date;
  readonly atime: Date;
  readonly ctime: Date;
}

/**
 * Finds the {@link FileSystemEntryType} of a directory entity.
 */
/* istanbul ignore next */
function getDirentType(dirent: Dirent): FileSystemEntryType {
  if (dirent.isFile()) return FileSystemEntryType.File;
  if (dirent.isDirectory()) return FileSystemEntryType.Directory;
  if (dirent.isSymbolicLink()) return FileSystemEntryType.SymbolicLink;
  if (dirent.isFIFO()) return FileSystemEntryType.FIFO;
  if (dirent.isSocket()) return FileSystemEntryType.Socket;
  if (dirent.isCharacterDevice()) return FileSystemEntryType.CharacterDevice;
  if (dirent.isBlockDevice()) return FileSystemEntryType.BlockDevice;
  throw new TypeError('dirent is not of a known type');
}

/**
 * Expected errors that can occur when trying to list directories at an absolute path.
 */
export type ListDirectoryError =
  | { type: 'permission-denied'; message: string }
  | { type: 'no-entity'; message: string }
  | { type: 'not-directory'; message: string };

/**
 * Get entries for a directory, includes stat information for each entry.
 * Requires that the path be absolute.
 */
export async function* listDirectory(
  path: string
): AsyncGenerator<Result<FileSystemEntry, ListDirectoryError>> {
  assert(isAbsolute(path));

  // Workaround for potential bug in `aspect-build/rules_js` sandbox fs patch
  // that throws incorrect errors on `fs.opendir` for non-dirs.
  // TODO: Fix upstream:
  // https://github.com/aspect-build/rules_js/blob/main/js/private/node-patches/src/fs.cts
  try {
    const dirStat = await fs.lstat(path);
    if (!dirStat.isDirectory()) {
      yield err({
        type: 'not-directory',
        message: `${path} is not a directory`,
      });

      return;
    }
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      yield err({
        type: 'no-entity',
        message: `${path} does not exist`,
      });

      return;
    }

    throw error;
  }

  try {
    const dir = await fs.opendir(path);

    for await (const entry of dir) {
      const entryPath = join(path, entry.name);
      const stat = await fs.lstat(entryPath);

      if (!entry.isFile() && !entry.isDirectory()) {
        continue;
      }

      yield ok({
        name: entry.name,
        path: entryPath,
        size: stat.size,
        type: getDirentType(entry),
        mtime: stat.mtime,
        atime: stat.atime,
        ctime: stat.ctime,
      });
    }
  } catch (e) {
    const error = e as { code: string };
    /* istanbul ignore next */
    switch (error.code) {
      case 'ENOENT':
        yield err({
          type: 'no-entity',
          message: `${path} does not exist`,
        });
        break;
      case 'ENOTDIR':
        yield err({
          type: 'not-directory',
          message: `${path} is not a directory`,
        });
        break;
      case 'EACCES':
        yield err({
          type: 'permission-denied',
          message: `insufficient permissions to read from ${path}`,
        });
        break;
      default:
        throw error;
    }
  }
}

/**
 * Get entries for a directory recursively, includes stat information for each entry.
 * Requires that the path be absolute. Includes directories in result.
 */
export async function* listDirectoryRecursive(
  path: string
): AsyncGenerator<Result<FileSystemEntry, ListDirectoryError>> {
  for await (const result of listDirectory(path)) {
    if (result.isErr()) {
      yield result;
    } else {
      const fileEntry = result.ok();
      if (fileEntry.type === FileSystemEntryType.Directory) {
        yield* listDirectoryRecursive(fileEntry.path);
      }
      yield result;
    }
  }
}
