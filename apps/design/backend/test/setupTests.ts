import {
  toMatchPdfSnapshot,
  ToMatchPdfSnapshotOptions,
} from '@vx/libs/image-utils/src';
import { cleanupCachedBrowser } from '@vx/libs/printing/src';
import { toMatchImageSnapshot } from 'jest-image-snapshot';

afterAll(async () => {
  await cleanupCachedBrowser();
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toMatchPdfSnapshot(options?: ToMatchPdfSnapshotOptions): Promise<R>;
    }
  }
}

expect.extend({ toMatchImageSnapshot, toMatchPdfSnapshot });
