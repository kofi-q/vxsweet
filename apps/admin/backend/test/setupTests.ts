import { cleanupCachedBrowser } from '@vx/libs/printing/src';
import { cleanupTestSuiteTmpFiles } from './cleanup';

afterAll(async () => {
  cleanupTestSuiteTmpFiles();
  await cleanupCachedBrowser();
});
