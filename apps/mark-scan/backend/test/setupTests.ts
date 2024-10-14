import { cleanupCachedBrowser } from '@vx/libs/printing/src';

afterAll(async () => {
  await cleanupCachedBrowser();
});
