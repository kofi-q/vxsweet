import { assertDefined } from '@vx/libs/basics/assert';
import { readElection } from '@vx/libs/fs/src';
import { famousNamesFixtures } from '@vx/libs/hmpb/src';
import {
  asSheet,
  DEFAULT_MARK_THRESHOLDS,
  type ElectionDefinition,
} from '@vx/libs/types/elections';
import { singlePrecinctSelectionFor } from '@vx/libs/utils/src';
import {
  DEFAULT_FAMOUS_NAMES_BALLOT_STYLE_ID,
  DEFAULT_FAMOUS_NAMES_PRECINCT_ID,
  DEFAULT_FAMOUS_NAMES_VOTES,
  renderBmdBallotFixture,
} from '@vx/libs/bmd-ballot-fixtures/src';
import { electionFamousNames2021Fixtures } from '@vx/libs/fixtures/src';
import { interpretSheet } from '../src/interpret';
import { pdfToPageImages } from '../test/helpers/interpretation';
import { benchmarkRegressionTest } from './benchmarking';

jest.setTimeout(60_000);

describe('Interpretation benchmark', () => {
  const { electionPath, precinctId } = famousNamesFixtures;
  let electionDefinition: ElectionDefinition;

  beforeAll(async () => {
    electionDefinition = (await readElection(electionPath)).unsafeUnwrap();
  });

  test('Blank HMPB', async () => {
    const famousNamesBmdBallot = asSheet(
      await pdfToPageImages(
        await renderBmdBallotFixture({
          electionDefinition:
            electionFamousNames2021Fixtures.electionDefinition,
          ballotStyleId: DEFAULT_FAMOUS_NAMES_BALLOT_STYLE_ID,
          precinctId: DEFAULT_FAMOUS_NAMES_PRECINCT_ID,
          votes: DEFAULT_FAMOUS_NAMES_VOTES,
        })
      ).toArray()
    );

    await benchmarkRegressionTest({
      label: 'BMD interpretation',
      func: async () => {
        await interpretSheet(
          {
            electionDefinition,
            precinctSelection: singlePrecinctSelectionFor(
              assertDefined(precinctId)
            ),
            testMode: true,
            markThresholds: DEFAULT_MARK_THRESHOLDS,
            adjudicationReasons: [],
          },
          famousNamesBmdBallot
        );
      },
      runs: 50,
    });
  });
});
