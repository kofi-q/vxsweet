import { readElection } from '@vx/libs/fs/src';
import {
  type Renderer,
  createPlaywrightRenderer,
  primaryElectionFixtures,
  renderAllBallotsAndCreateElectionDefinition,
  vxDefaultBallotTemplate,
} from '@vx/libs/hmpb/src';
import { assert } from '@vx/libs/basics/src';
import { iter } from '@vx/libs/basics/src/iterators';
import { getBallotStylesByPrecinctId } from '@vx/libs/utils/src/tabulation';
import { type ElectionDefinition, LanguageCode } from '@vx/libs/types/src';
import { createPrecinctTestDeck } from '../../test_decks';
import '@vx/libs/image-test-utils/register';

jest.setTimeout(30000);

let renderer: Renderer;
beforeAll(async () => {
  renderer = await createPlaywrightRenderer();
});
afterAll(async () => {
  await renderer.cleanup();
});

describe('createPrecinctTestDeck', () => {
  test('for a precinct with multiple ballot styles', async () => {
    const fixtures = primaryElectionFixtures;
    const primaryElectionDefinition = (
      await readElection(fixtures.electionPath)
    ).unsafeUnwrap();
    // Test takes unnecessarily long if using all language ballot styles
    const electionDefinition: ElectionDefinition = {
      ...primaryElectionDefinition,
      election: {
        ...primaryElectionDefinition.election,
        ballotStyles: primaryElectionDefinition.election.ballotStyles.filter(
          (bs) =>
            bs.languages &&
            bs.languages.length === 1 &&
            bs.languages[0] === LanguageCode.ENGLISH
        ),
      },
    };
    const { election } = electionDefinition;
    const precinctId = election.precincts[0].id;
    assert(
      getBallotStylesByPrecinctId(electionDefinition, precinctId).length > 1
    );
    const { ballotDocuments } =
      await renderAllBallotsAndCreateElectionDefinition(
        renderer,
        vxDefaultBallotTemplate,
        fixtures.allBallotProps,
        'vxf'
      );
    const ballots = iter(fixtures.allBallotProps)
      .zip(ballotDocuments)
      .map(([props, document]) => ({ props, document }))
      .toArray();

    const testDeckDocument = await createPrecinctTestDeck({
      renderer,
      election,
      precinctId,
      ballots,
    });
    await expect(testDeckDocument).toMatchPdfSnapshot({
      failureThreshold: 0.05,
    });
  });
});
