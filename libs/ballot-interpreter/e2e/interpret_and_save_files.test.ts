import {
  DEFAULT_FAMOUS_NAMES_BALLOT_STYLE_ID,
  DEFAULT_FAMOUS_NAMES_PRECINCT_ID,
  DEFAULT_FAMOUS_NAMES_VOTES,
  renderBmdBallotFixture,
} from '@vx/libs/bmd-ballot-fixtures/src';
import * as electionFamousNames2021Fixtures from '@vx/libs/fixtures/src/data/electionFamousNames2021';
import { loadImageData } from '@vx/libs/image-utils/src';
import { DEFAULT_MARK_THRESHOLDS, asSheet } from '@vx/libs/types/elections';
import { ALL_PRECINCTS_SELECTION } from '@vx/libs/utils/src';
import { pdfToPageImages } from '../test/helpers/interpretation';
import { tmpDir } from '../test/helpers/tmp';
import { interpretSheetAndSaveImages } from '../src/interpret';

test('interprets ballot images and saves images for storage', async () => {
  const fixtures = electionFamousNames2021Fixtures;
  const electionDefinition = fixtures.electionJson.toElectionDefinition();
  const testBallot = asSheet(
    await pdfToPageImages(
      await renderBmdBallotFixture({
        electionDefinition,
        precinctId: DEFAULT_FAMOUS_NAMES_PRECINCT_ID,
        ballotStyleId: DEFAULT_FAMOUS_NAMES_BALLOT_STYLE_ID,
        votes: DEFAULT_FAMOUS_NAMES_VOTES,
      })
    ).toArray()
  );

  const ballotImagesPath = tmpDir();
  const result = await interpretSheetAndSaveImages(
    {
      electionDefinition,
      precinctSelection: ALL_PRECINCTS_SELECTION,
      testMode: true,
      markThresholds: DEFAULT_MARK_THRESHOLDS,
      adjudicationReasons: [],
    },
    testBallot,
    'sheet-id',
    ballotImagesPath
  );

  expect(result.map(({ interpretation }) => interpretation.type)).toEqual([
    'InterpretedBmdPage',
    'BlankPage',
  ]);
  for (const { imagePath } of result) {
    await expect(loadImageData(imagePath)).resolves.toBeDefined();
  }
});
