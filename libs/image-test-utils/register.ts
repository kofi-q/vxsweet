import { ImageData } from '@vx/libs/image-utils/src';
import {
  ToMatchPdfSnapshotOptions,
  toMatchPdfSnapshot,
} from './jest_pdf_snapshot';
import { ToMatchImageOptions, toMatchImage } from './jest_match_image';

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

expect.extend({ toMatchImage, toMatchPdfSnapshot });
