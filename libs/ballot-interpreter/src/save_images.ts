import { encodeImageData, ImageData } from '@vx/libs/image-utils/src';
import { mapSheet, type SheetOf } from '@vx/libs/types/elections';
import { time } from '@vx/libs/utils/src';
import makeDebug from 'debug';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const debug = makeDebug('ballot-interpreter:save-images');

/**
 * Stores the images for a ballot in the ballot images directory.
 */
export async function saveSheetImages({
  sheetId,
  ballotImagesPath,
  images,
}: {
  sheetId: string;
  ballotImagesPath: string;
  images: SheetOf<ImageData>;
}): Promise<SheetOf<string>> {
  const timer = time(debug, `saveSheetImages: sheetId=${sheetId}`);
  const destinationImagePaths = await mapSheet(images, async (image, side) => {
    const sideTimer = time(
      debug,
      `saveSheetImages: sheetId=${sheetId}, side=${side}`
    );
    const destinationImagePath = join(
      ballotImagesPath,
      `${sheetId}-${side}.png`
    );
    const buffer = await encodeImageData(image, 'image/png');
    sideTimer.checkpoint('writeImageDataToBuffer');
    await writeFile(destinationImagePath, buffer);
    sideTimer.checkpoint('writeFile');
    return destinationImagePath;
  });
  timer.end();
  return destinationImagePaths;
}
