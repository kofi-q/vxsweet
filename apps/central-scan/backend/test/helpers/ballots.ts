import { iter } from '@vx/libs/basics/iterators';
import {
  DEFAULT_FAMOUS_NAMES_BALLOT_STYLE_ID,
  DEFAULT_FAMOUS_NAMES_PRECINCT_ID,
  DEFAULT_FAMOUS_NAMES_VOTES,
  renderBmdBallotFixture,
} from '@vx/libs/bmd-ballot-fixtures/src';
import { electionFamousNames2021Fixtures } from '@vx/libs/fixtures/src';
import { pdfToImages, writeImageData } from '@vx/libs/image-utils/src';
import { type SheetOf, asSheet } from '@vx/libs/types/src';
import { tmpNameSync } from 'tmp';

export async function generateBmdBallotFixture(): Promise<SheetOf<string>> {
  const ballotPdf = await renderBmdBallotFixture({
    electionDefinition: electionFamousNames2021Fixtures.electionDefinition,
    ballotStyleId: DEFAULT_FAMOUS_NAMES_BALLOT_STYLE_ID,
    precinctId: DEFAULT_FAMOUS_NAMES_PRECINCT_ID,
    votes: DEFAULT_FAMOUS_NAMES_VOTES,
  });
  return asSheet(
    await iter(pdfToImages(ballotPdf, { scale: 200 / 72 }))
      .map(async ({ page }) => {
        const path = tmpNameSync({ postfix: '.png' });
        await writeImageData(path, page);
        return path;
      })
      .toArray()
  );
}
