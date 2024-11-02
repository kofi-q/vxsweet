import { readElection } from '@vx/libs/fs/src';
import {
  type Renderer,
  createPlaywrightRenderer,
  famousNamesFixtures,
  generalElectionFixtures,
  renderAllBallotsAndCreateElectionDefinition,
  vxDefaultBallotTemplate,
} from '@vx/libs/hmpb/src';
import { assert, find } from '@vx/libs/basics/src';
import { iter } from '@vx/libs/basics/src/iterators';
import { getBallotStylesByPrecinctId } from '@vx/libs/utils/src/tabulation';
import { createPrecinctTestDeck } from '../../src/test_decks';
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
  test('for a precinct with one ballot style', async () => {
    const fixtures = famousNamesFixtures;
    const electionDefinition = (
      await readElection(fixtures.electionPath)
    ).unsafeUnwrap();
    const { election } = electionDefinition;
    const precinctId = election.precincts[0].id;
    assert(
      getBallotStylesByPrecinctId(electionDefinition, precinctId).length === 1
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
    await expect(testDeckDocument).toMatchPdfSnapshot();
  });

  test('for a precinct with no ballot styles', async () => {
    const fixtures = generalElectionFixtures.fixtureSpecs[0];
    const electionDefinition = (
      await readElection(fixtures.electionPath)
    ).unsafeUnwrap();
    const { election } = electionDefinition;
    const precinctWithNoBallotStyles = find(
      election.precincts,
      (precinct) =>
        getBallotStylesByPrecinctId(electionDefinition, precinct.id).length ===
        0
    );

    const testDeckDocument = await createPrecinctTestDeck({
      renderer,
      election,
      precinctId: precinctWithNoBallotStyles.id,
      ballots: [], // doesn't matter
    });
    expect(testDeckDocument).toBeUndefined();
  });
});
