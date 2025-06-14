import { readElection } from '@vx/libs/fs/src';
import {
  type Renderer,
  createPlaywrightRenderer,
  famousNamesFixtures,
  generalElectionFixtures,
  primaryElectionFixtures,
} from '@vx/libs/hmpb/src';
import { find } from '@vx/libs/basics/collections';
import { buildContestResultsFixture } from '@vx/libs/utils/src/tabulation';
import {
  createTestDeckTallyReport,
  getTallyReportResults,
} from '../test_decks';
import '@vx/libs/image-test-utils/register';

jest.setTimeout(30000);

let renderer: Renderer;
beforeAll(async () => {
  renderer = await createPlaywrightRenderer();
});
afterAll(async () => {
  await renderer.cleanup();
});

describe('getTallyReportResults', () => {
  test('general', async () => {
    const fixtures = famousNamesFixtures;
    const electionDefinition = (
      await readElection(fixtures.electionPath)
    ).unsafeUnwrap();
    const { election } = electionDefinition;

    const tallyReportResults = await getTallyReportResults(election);

    expect(tallyReportResults.hasPartySplits).toEqual(false);
    expect(tallyReportResults.contestIds).toEqual(
      election.contests.map((c) => c.id)
    );
    expect(tallyReportResults.manualResults).toBeUndefined();
    const { scannedResults } = tallyReportResults;
    expect(scannedResults.cardCounts).toEqual({
      bmd: 0,
      hmpb: [52],
    });

    // check one contest
    expect(scannedResults.contestResults['board-of-alderman']).toEqual(
      buildContestResultsFixture({
        contest: find(election.contests, (c) => c.id === 'board-of-alderman'),
        contestResultsSummary: {
          type: 'candidate',
          ballots: 52,
          overvotes: 0,
          undervotes: 156,
          officialOptionTallies: {
            'helen-keller': 8,
            'nikola-tesla': 8,
            'pablo-picasso': 4,
            'steve-jobs': 8,
            'vincent-van-gogh': 4,
            'wolfgang-amadeus-mozart': 4,
            'write-in': 16,
          },
        },
        includeGenericWriteIn: true,
      })
    );
  });

  test('primary', async () => {
    const fixtures = primaryElectionFixtures;
    const electionDefinition = (
      await readElection(fixtures.electionPath)
    ).unsafeUnwrap();
    const { election } = electionDefinition;

    const tallyReportResults = await getTallyReportResults(election);

    expect(tallyReportResults.hasPartySplits).toEqual(true);
    expect(tallyReportResults.contestIds).toEqual(
      election.contests.map((c) => c.id)
    );
    expect(tallyReportResults.manualResults).toBeUndefined();
    expect(
      tallyReportResults.hasPartySplits && tallyReportResults.cardCountsByParty
    ).toEqual({
      '0': {
        bmd: 0,
        hmpb: [100],
      },
      '1': {
        bmd: 0,
        hmpb: [100],
      },
    });
    const { scannedResults } = tallyReportResults;
    expect(scannedResults.cardCounts).toEqual({
      bmd: 0,
      hmpb: [200],
      manual: 0,
    });

    // check one contest
    expect(scannedResults.contestResults['county-leader-mammal']).toEqual(
      buildContestResultsFixture({
        contest: find(
          election.contests,
          (c) => c.id === 'county-leader-mammal'
        ),
        contestResultsSummary: {
          type: 'candidate',
          ballots: 100,
          overvotes: 0,
          undervotes: 0,
          officialOptionTallies: {
            fox: 20,
            horse: 40,
            otter: 40,
          },
        },
        includeGenericWriteIn: false,
      })
    );
  });
});

test('createTestDeckTallyReport', async () => {
  const fixtures = generalElectionFixtures.fixtureSpecs[0];
  const electionDefinition = (
    await readElection(fixtures.electionPath)
  ).unsafeUnwrap();

  const reportDocumentBuffer = await createTestDeckTallyReport({
    electionDefinition,
    generatedAtTime: new Date('2021-01-01T00:00:00.000'),
  });

  await expect(reportDocumentBuffer).toMatchPdfSnapshot({
    failureThreshold: 0.0001,
  });
});
