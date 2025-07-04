import { assert, assertDefined } from '@vx/libs/basics/assert';
import { iter } from '@vx/libs/basics/iterators';
import { Buffer } from 'node:buffer';
import { election as electionGeneral } from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { election as electionFamousNames } from '@vx/libs/fixtures/src/data/electionFamousNames2021/election.json';
import { election as electionPrimaryPrecinctSplits } from '@vx/libs/fixtures/src/data/electionPrimaryPrecinctSplits/election.json';
import {
  HmpbBallotPaperSize,
  type BallotStyle,
  type BallotStyleId,
  BallotType,
  type Election,
  getBallotStyle,
  getContests,
  type VotesDict,
} from '@vx/libs/types/elections';
import { LanguageCode } from '@vx/libs/types/languages';
import { join } from 'node:path';
import makeDebug from 'debug';
import { pdfToImages } from '@vx/libs/image-utils/src';
import { markBallotDocument, voteIsCandidate } from './mark_ballot';
import {
  type BaseBallotProps,
  renderAllBallotsAndCreateElectionDefinition,
} from './render_ballot';
import { vxDefaultBallotTemplate } from './vx_default_ballot_template';
import { type Renderer } from './renderer';

const debug = makeDebug('hmpb:ballot_fixtures');

export const fixturesDir = join(__dirname, '../fixtures');

export const famousNamesFixtures = (() => {
  const dir = join(fixturesDir, 'famous-names');
  const electionPath = join(dir, 'election.json');
  const blankBallotPath = join(dir, 'blank-ballot.pdf');
  const markedBallotPath = join(dir, 'marked-ballot.pdf');

  const election = electionFamousNames;
  const allBallotProps = election.ballotStyles.flatMap((ballotStyle) =>
    ballotStyle.precincts.map(
      (precinctId): BaseBallotProps => ({
        election,
        ballotStyleId: ballotStyle.id,
        precinctId,
        ballotType: BallotType.Precinct,
        ballotMode: 'test',
      })
    )
  );
  const blankBallotProps = allBallotProps[0];
  const ballotStyle = assertDefined(
    getBallotStyle({ election, ballotStyleId: blankBallotProps.ballotStyleId })
  );
  const contests = getContests({ election, ballotStyle });
  const votes: VotesDict = Object.fromEntries(
    contests.map((contest, i) => {
      assert(contest.type === 'candidate');
      const candidates = iter(contest.candidates)
        .cycle()
        .skip(i)
        .take(contest.seats)
        .toArray()
        // list candidates in the order they appear on the ballot
        .sort(
          (a, b) =>
            contest.candidates.indexOf(a) - contest.candidates.indexOf(b)
        );
      return [contest.id, candidates];
    })
  );

  return {
    dir,
    electionPath,
    blankBallotPath,
    markedBallotPath,
    allBallotProps,
    ...blankBallotProps,
    votes,

    async generate(renderer: Renderer, { markedOnly = false } = {}) {
      debug(`Generating: ${blankBallotPath}`);
      const { electionDefinition, ballotDocuments } =
        await renderAllBallotsAndCreateElectionDefinition(
          renderer,
          vxDefaultBallotTemplate,
          allBallotProps,
          'vxf'
        );

      const blankBallot = ballotDocuments[0];
      const blankBallotPdf = markedOnly
        ? Buffer.from('')
        : await blankBallot.renderToPdf();

      debug(`Generating: ${markedBallotPath}`);
      const markedBallot = await markBallotDocument(
        renderer,
        blankBallot,
        votes
      );
      const markedBallotPdf = await markedBallot.renderToPdf();

      return {
        electionDefinition,
        blankBallotPdf,
        markedBallotPdf,
      };
    },
  };
})();

export const generalElectionFixtures = (() => {
  const dir = join(fixturesDir, 'general-election');

  function makeElectionFixtureSpec(election: Election) {
    const electionDir = join(
      dir,
      [election.ballotLayout.paperSize, election.ballotStyles[0].languages?.[0]]
        .filter((label) => Boolean(label))
        .join('-')
    );
    const electionPath = join(electionDir, 'election.json');
    const blankBallotPath = join(electionDir, 'blank-ballot.pdf');
    const markedBallotPath = join(electionDir, 'marked-ballot.pdf');
    const allBallotProps = election.ballotStyles.flatMap((ballotStyle) =>
      ballotStyle.precincts.map(
        (precinctId): BaseBallotProps => ({
          election,
          ballotStyleId: ballotStyle.id,
          precinctId,
          ballotType: BallotType.Absentee,
          ballotMode: 'official',
        })
      )
    );

    // Has ballot measures
    const ballotStyle = assertDefined(
      getBallotStyle({ election, ballotStyleId: '12' as BallotStyleId })
    );
    const precinctId = assertDefined(ballotStyle.precincts[0]);

    const contests = getContests({ election, ballotStyle });
    const votes: VotesDict = Object.fromEntries(
      contests.map((contest, i) => {
        if (contest.type === 'candidate') {
          const candidates = iter(contest.candidates)
            .cycle()
            .skip(i)
            .take(contest.seats - (i % 2))
            .toArray();
          if (contest.allowWriteIns && i % 2 === 0) {
            const writeInIndex = i % contest.seats;
            candidates.push({
              id: `write-in-${writeInIndex}`,
              name: `Write-In #${writeInIndex + 1}`,
              isWriteIn: true,
              writeInIndex,
            });
          }
          return [contest.id, candidates];
        }
        return [
          contest.id,
          i % 2 === 0 ? [contest.yesOption.id] : [contest.noOption.id],
        ];
      })
    );

    const unmarkedWriteIns = contests.flatMap((contest, i) => {
      if (!(contest.type === 'candidate' && contest.allowWriteIns)) {
        return [];
      }
      // Skip contests where we already voted for a write-in above
      if (
        assertDefined(votes[contest.id]).some(
          (vote) => voteIsCandidate(vote) && vote.isWriteIn
        )
      ) {
        return [];
      }

      const writeInIndex = i % contest.seats;
      return [
        {
          contestId: contest.id,
          writeInIndex,
          name: `Unmarked Write-In #${writeInIndex + 1}`,
        },
      ];
    });

    const { paperSize } = election.ballotLayout;
    const languageCode = ballotStyle.languages?.[0] ?? LanguageCode.ENGLISH;
    return {
      electionDir,
      paperSize,
      languageCode,
      electionPath,
      allBallotProps,
      precinctId,
      ballotStyleId: ballotStyle.id,
      votes,
      unmarkedWriteIns,
      blankBallotPath,
      markedBallotPath,
      generatePageImages:
        paperSize === HmpbBallotPaperSize.Letter &&
        languageCode === LanguageCode.ENGLISH,
    };
  }

  const paperSizeElections = Object.values(HmpbBallotPaperSize).map(
    (paperSize) => ({
      ...electionGeneral,
      ballotLayout: { ...electionGeneral.ballotLayout, paperSize },
    })
  );

  const languageElections = [
    LanguageCode.CHINESE_SIMPLIFIED,
    LanguageCode.CHINESE_TRADITIONAL,
    LanguageCode.SPANISH,
  ].map((language) => ({
    ...electionGeneral,
    ballotLayout: {
      ...electionGeneral.ballotLayout,
      paperSize: HmpbBallotPaperSize.Legal,
    },
    ballotStyles: electionGeneral.ballotStyles.map((ballotStyle) => ({
      ...ballotStyle,
      languages: [language, LanguageCode.ENGLISH],
    })),
  }));

  const fixtureSpecs = [...paperSizeElections, ...languageElections].map(
    makeElectionFixtureSpec
  );

  return {
    fixtureSpecs,

    async generate(
      renderer: Renderer,
      specs: Array<ReturnType<typeof makeElectionFixtureSpec>>
    ) {
      async function generateElectionFixtures(
        spec: ReturnType<typeof makeElectionFixtureSpec>
      ) {
        debug(`Generating: ${spec.blankBallotPath}`);
        const { electionDefinition, ballotDocuments } =
          await renderAllBallotsAndCreateElectionDefinition(
            renderer,
            vxDefaultBallotTemplate,
            spec.allBallotProps,
            'vxf'
          );
        const [blankBallot] = assertDefined(
          iter(ballotDocuments)
            .zip(spec.allBallotProps)
            .find(
              ([, props]) =>
                props.ballotStyleId === spec.ballotStyleId &&
                props.precinctId === spec.precinctId
            )
        );
        const blankBallotPdf = await blankBallot.renderToPdf();

        debug(`Generating: ${spec.markedBallotPath}`);
        const markedBallot = await markBallotDocument(
          renderer,
          blankBallot,
          spec.votes,
          spec.unmarkedWriteIns
        );
        const markedBallotPdf = await markedBallot.renderToPdf();

        let blankBallotPageImages;
        if (spec.generatePageImages) {
          debug(`Generating page images for: ${spec.blankBallotPath}`);
          blankBallotPageImages = await iter(
            pdfToImages(blankBallotPdf, {
              scale: 200 / 72,
            })
          )
            .map(({ page }) => page)
            .toArray();
        }

        return {
          electionDefinition,
          blankBallotPdf,
          markedBallotPdf,
          blankBallotPageImages,
        };
      }

      return await Promise.all(specs.map(generateElectionFixtures));
    },
  };
})();

export const primaryElectionFixtures = (() => {
  const dir = join(fixturesDir, 'primary-election');
  const electionPath = join(dir, 'election.json');

  const election = electionPrimaryPrecinctSplits;
  const allBallotProps = election.ballotStyles.flatMap((ballotStyle) =>
    ballotStyle.precincts.map(
      (precinctId): BaseBallotProps => ({
        election,
        ballotStyleId: ballotStyle.id,
        precinctId,
        ballotType: BallotType.Precinct,
        ballotMode: 'test',
      })
    )
  );

  function makePartyFixtureSpec(partyLabel: string, ballotStyle: BallotStyle) {
    const blankBallotPath = join(dir, `${partyLabel}-blank-ballot.pdf`);
    const otherPrecinctBlankBallotPath = join(
      dir,
      `${partyLabel}-other-precinct-blank-ballot.pdf`
    );
    const markedBallotPath = join(dir, `${partyLabel}-marked-ballot.pdf`);

    const precinctId = assertDefined(ballotStyle.precincts[0]);
    const otherPrecinctId = assertDefined(ballotStyle.precincts[1]);
    assert(precinctId !== otherPrecinctId);
    const contests = getContests({ election, ballotStyle });
    const votes: VotesDict = Object.fromEntries(
      contests.map((contest, i) => {
        if (contest.type === 'candidate') {
          const candidates = iter(contest.candidates)
            .cycle()
            .skip(i)
            .take(contest.seats)
            .toArray();
          return [contest.id, candidates];
        }
        return [
          contest.id,
          i % 2 === 0 ? [contest.yesOption.id] : [contest.noOption.id],
        ];
      })
    );

    return {
      ballotStyleId: ballotStyle.id,
      otherPrecinctId,
      precinctId,
      blankBallotPath,
      otherPrecinctBlankBallotPath,
      markedBallotPath,
      votes,
    };
  }

  const mammalParty = makePartyFixtureSpec(
    'mammal',
    assertDefined(
      getBallotStyle({ election, ballotStyleId: '1-Ma_en' as BallotStyleId })
    )
  );
  const fishParty = makePartyFixtureSpec(
    'fish',
    assertDefined(
      getBallotStyle({ election, ballotStyleId: '1-F_en' as BallotStyleId })
    )
  );

  return {
    dir,
    allBallotProps,
    electionPath,
    mammalParty,
    fishParty,

    async generate(renderer: Renderer, { markedOnly = false } = {}) {
      const { electionDefinition, ballotDocuments } =
        await renderAllBallotsAndCreateElectionDefinition(
          renderer,
          vxDefaultBallotTemplate,
          allBallotProps,
          'vxf'
        );

      async function generatePartyFixtures(
        spec: ReturnType<typeof makePartyFixtureSpec>
      ) {
        debug(`Generating: ${spec.blankBallotPath}`);
        const [blankBallot] = assertDefined(
          iter(ballotDocuments)
            .zip(allBallotProps)
            .find(
              ([, props]) =>
                props.ballotStyleId === spec.ballotStyleId &&
                props.precinctId === spec.precinctId
            )
        );
        const blankBallotPdf = markedOnly
          ? Buffer.from('')
          : await blankBallot.renderToPdf();

        debug(`Generating: ${spec.otherPrecinctBlankBallotPath}`);
        const [otherPrecinctBlankBallot] = assertDefined(
          iter(ballotDocuments)
            .zip(allBallotProps)
            .find(
              ([, props]) =>
                props.ballotStyleId === spec.ballotStyleId &&
                props.precinctId === spec.otherPrecinctId
            )
        );
        const otherPrecinctBlankBallotPdf = markedOnly
          ? Buffer.from('')
          : await otherPrecinctBlankBallot.renderToPdf();

        debug(`Generating: ${spec.markedBallotPath}`);
        const markedBallot = await markBallotDocument(
          renderer,
          blankBallot,
          spec.votes
        );
        const markedBallotPdf = await markedBallot.renderToPdf();

        return {
          electionDefinition,
          blankBallotPdf,
          otherPrecinctBlankBallotPdf,
          markedBallotPdf,
        };
      }

      return {
        electionDefinition,
        mammalParty: await generatePartyFixtures(mammalParty),
        fishParty: await generatePartyFixtures(fishParty),
      };
    },
  };
})();
