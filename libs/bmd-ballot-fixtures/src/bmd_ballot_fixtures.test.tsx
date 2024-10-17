import { electionFamousNames2021Fixtures } from '@vx/libs/fixtures/src';
import { pdfToImages, toImageBuffer } from '@vx/libs/image-utils/src';
import { iter } from '@vx/libs/basics/src';
import { readFile } from '@vx/libs/fs/src';
import {
  renderBmdBallotFixture,
  writeFirstBallotPageToImageFile,
} from './bmd_ballot_fixtures';
import '@vx/libs/image-test-utils/register';

const MAX_BALLOT_IMAGE_SIZE_BYTES = 250 * 1024;

test('renderBmdBallotFixture', async () => {
  const pdf = await renderBmdBallotFixture({
    electionDefinition: electionFamousNames2021Fixtures.electionDefinition,
  });
  const pages = await iter(pdfToImages(pdf, { scale: 200 / 72 }))
    .map((page) => toImageBuffer(page.page))
    .toArray();
  expect(pages.length).toEqual(2);
  expect(pages[0]).toMatchImageSnapshot();
  expect(pages[1]).toMatchImageSnapshot();
});

test('renderBmdBallotFixture rotated', async () => {
  const pdf = await renderBmdBallotFixture({
    electionDefinition: electionFamousNames2021Fixtures.electionDefinition,
    rotateImage: true,
  });

  const pages = await iter(pdfToImages(pdf, { scale: 200 / 72 }))
    .map((page) => toImageBuffer(page.page))
    .toArray();
  expect(pages.length).toEqual(2);
  expect(pages[0]).toMatchImageSnapshot();
  expect(pages[1]).toMatchImageSnapshot();
});

test('writeFirstBallotPageToImageFile', async () => {
  const pdf = await renderBmdBallotFixture({
    electionDefinition: electionFamousNames2021Fixtures.electionDefinition,
  });
  const imagePath = await writeFirstBallotPageToImageFile(pdf);

  const imageData = await readFile(imagePath, {
    maxSize: MAX_BALLOT_IMAGE_SIZE_BYTES,
  });
  imageData.assertOk('Error reading image data from file');
  expect(imageData.ok()).toMatchImageSnapshot();
});
