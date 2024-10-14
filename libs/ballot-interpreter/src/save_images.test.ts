import { createImageData, ImageData } from '@vx/libs/image-utils/src';
import { SheetOf } from '@vx/libs/types/src';
import { join } from 'node:path';
import { tmpDir } from '../test/helpers/tmp';
import { saveSheetImages } from './save_images';

test('saveSheetImages', async () => {
  const sheetId = 'sheetId';
  const ballotImagesPath = tmpDir();
  const images: SheetOf<ImageData> = [
    createImageData(1, 1),
    createImageData(1, 1),
  ];

  const destinationImagePaths = await saveSheetImages({
    sheetId,
    ballotImagesPath,
    images,
  });

  expect(destinationImagePaths).toEqual([
    join(ballotImagesPath, `sheetId-front.png`),
    join(ballotImagesPath, `sheetId-back.png`),
  ]);
});
