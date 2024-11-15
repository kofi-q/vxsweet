import { Buffer } from 'node:buffer';
import { err, ok } from '@vx/libs/basics/result';
import * as sampleBallotImages from '@vx/libs/fixtures/src/data/sample-ballot-images';
import * as electionFamousNames2021Fixtures from '@vx/libs/fixtures/src/data/electionFamousNames2021';
import { renderBmdBallotFixture } from '@vx/libs/bmd-ballot-fixtures/src';
import {
  type QrCodePageResult,
  detectInBallot,
  getSearchAreas,
} from './qrcode';
import { pdfToPageImages } from '../../../test/helpers/interpretation';

test('does not find QR codes when there are none to find', async () => {
  const detectResult = await detectInBallot(
    await sampleBallotImages.notBallot.asImageData()
  );
  expect(detectResult).toEqual<QrCodePageResult>(err({ type: 'no-qr-code' }));
});

test('can read metadata encoded in a QR code with base64', async () => {
  const ballotPdf = await renderBmdBallotFixture({
    electionDefinition:
      electionFamousNames2021Fixtures.electionJson.toElectionDefinition(),
  });
  const pageImages = await pdfToPageImages(ballotPdf).toArray();
  const detectResult = await detectInBallot(pageImages[0]!);
  expect(detectResult).toEqual<QrCodePageResult>(
    ok({
      data: expect.any(Buffer),
      position: 'top',
      detector: 'qrdetect',
    })
  );
});

test('getSearchArea', () => {
  expect([...getSearchAreas({ width: 85, height: 110 })]).toHaveLength(
    2 // 1 top, 1 bottom
  );
});
