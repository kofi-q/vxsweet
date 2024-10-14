import { toMatchImageSnapshot } from 'jest-image-snapshot';
import { cleanupCachedBrowser } from '@vx/libs/printing/src';

afterAll(async () => {
  await cleanupCachedBrowser();
});

expect.extend({ toMatchImageSnapshot });
