/* istanbul ignore file - this file should only have exports, no logic to test */

import { ImageData } from 'canvas';
import { ToMatchImageOptions } from './jest_match_image';
import { ToMatchPdfSnapshotOptions } from './jest_pdf_snapshot';

export * from './crop';
export * from './image_data';
export * from './pdf_to_images';
export * from './jest_match_image';
export * from './jest_pdf_snapshot';
export * from './test_utils';
export * from './types';
export { createImageData, ImageData } from 'canvas';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toMatchPdfSnapshot(options?: ToMatchPdfSnapshotOptions): Promise<R>;
      toMatchImage(
        expected: ImageData,
        options?: ToMatchImageOptions
      ): Promise<R>;
    }
  }
}
