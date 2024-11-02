import { assertDefined } from '@vx/libs/basics/src';
import { readElection } from '@vx/libs/fs/src';
import { famousNamesFixtures } from '@vx/libs/hmpb/src';
import {
  asSheet,
  DEFAULT_MARK_THRESHOLDS,
  type ElectionDefinition,
} from '@vx/libs/types/src';
import { singlePrecinctSelectionFor } from '@vx/libs/utils/src';
import { interpretSheet } from '../src/interpret';
import { pdfToPageImages } from '../test/helpers/interpretation';
import { benchmarkRegressionTest } from './benchmarking';

jest.setTimeout(60_000);

describe('Interpretation benchmark', () => {
  const { electionPath, precinctId, blankBallotPath, markedBallotPath } =
    famousNamesFixtures;
  let electionDefinition: ElectionDefinition;
  beforeAll(async () => {
    electionDefinition = (await readElection(electionPath)).unsafeUnwrap();
  });

  test('Blank HMPB', async () => {
    const ballotImages = asSheet(
      await pdfToPageImages(blankBallotPath).toArray()
    );

    await benchmarkRegressionTest({
      label: 'Blank HMPB interpretation',
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
          ballotImages
        );
      },
      runs: 50,
    });
  });

  test('Marked HMPB', async () => {
    const ballotImages = asSheet(
      await pdfToPageImages(markedBallotPath).toArray()
    );

    await benchmarkRegressionTest({
      label: 'Marked HMPB interpretation',
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
          ballotImages
        );
      },
      runs: 50,
    });
  });
});
