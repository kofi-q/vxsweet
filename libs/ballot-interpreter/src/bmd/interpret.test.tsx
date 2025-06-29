import * as electionFamousNames from '@vx/libs/fixtures/src/data/electionFamousNames2021/election.json';
import { sliceBallotHashForEncoding } from '@vx/libs/ballot-encoder/src';
import { assert } from '@vx/libs/basics/assert';
import { err } from '@vx/libs/basics/result';
import * as sampleBallotImages from '@vx/libs/fixtures/src/data/sample-ballot-images';
import * as electionGridLayoutNewHampshire from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot/election.json';
import { type SheetOf, asSheet } from '@vx/libs/types/elections';
import {
  renderBmdBallotFixture,
  DEFAULT_FAMOUS_NAMES_BALLOT_STYLE_ID,
  DEFAULT_FAMOUS_NAMES_PRECINCT_ID,
  DEFAULT_FAMOUS_NAMES_VOTES,
} from '@vx/libs/bmd-ballot-fixtures/src';
import { ImageData, createCanvas } from 'canvas';
import { type InterpretResult, interpret } from './interpret';
import { pdfToPageImages } from '../../test/helpers/interpretation';
import '@vx/libs/image-test-utils/register';

let famousNamesBmdBallot: SheetOf<ImageData>;
let famousNamesBmdBallotUpsideDown: SheetOf<ImageData>;

function copyImageData(imageData: ImageData): ImageData {
  // Create a new canvas element
  const newImageData = new ImageData(imageData.width, imageData.height);
  newImageData.data.set(imageData.data.slice());
  return newImageData;
}

beforeAll(async () => {
  famousNamesBmdBallot = asSheet(
    await pdfToPageImages(
      await renderBmdBallotFixture({
        electionDefinition: electionFamousNames.toElectionDefinition(),
        ballotStyleId: DEFAULT_FAMOUS_NAMES_BALLOT_STYLE_ID,
        precinctId: DEFAULT_FAMOUS_NAMES_PRECINCT_ID,
        votes: DEFAULT_FAMOUS_NAMES_VOTES,
      })
    ).toArray()
  );

  famousNamesBmdBallotUpsideDown = asSheet(
    await pdfToPageImages(
      await renderBmdBallotFixture({
        electionDefinition: electionFamousNames.toElectionDefinition(),
        ballotStyleId: DEFAULT_FAMOUS_NAMES_BALLOT_STYLE_ID,
        precinctId: DEFAULT_FAMOUS_NAMES_PRECINCT_ID,
        votes: DEFAULT_FAMOUS_NAMES_VOTES,
        rotateImage: true,
      })
    ).toArray()
  );
});

test('happy path: front, back', async () => {
  const card = famousNamesBmdBallot;
  const result = await interpret(
    electionFamousNames.toElectionDefinition(),
    card
  );
  const { ballot, summaryBallotImage, blankPageImage } = result.unsafeUnwrap();
  expect(ballot).toMatchSnapshot();

  // don't use Jest `toEqual` matcher because it tries to pretty print the
  // ImageData objects, which is slow and causes the test to time out
  assert(summaryBallotImage === card[0]);
  assert(blankPageImage === card[1]);
});

test('happy path: back, front', async () => {
  const card = famousNamesBmdBallot;
  const result = await interpret(electionFamousNames.toElectionDefinition(), [
    card[1],
    card[0],
  ]);
  const { ballot, summaryBallotImage, blankPageImage } = result.unsafeUnwrap();
  expect(ballot).toMatchSnapshot();

  // don't use Jest `toEqual` matcher because it tries to pretty print the
  // ImageData objects, which is slow and causes the test to time out
  assert(summaryBallotImage === card[0]);
  assert(blankPageImage === card[1]);
});

test('happy path: front upside down, back', async () => {
  const cardFlipped = famousNamesBmdBallotUpsideDown;
  const cardOriginal = famousNamesBmdBallot;
  const resultFlipped = await interpret(
    electionFamousNames.toElectionDefinition(),
    [cardFlipped[0], copyImageData(cardFlipped[1])]
  );
  const resultOriginal = await interpret(
    electionFamousNames.toElectionDefinition(),
    cardOriginal
  );
  const {
    ballot: ballotFlipped,
    summaryBallotImage: summaryBallotImageFlipped,
    blankPageImage: blankPageImageFlipped,
  } = resultFlipped.unsafeUnwrap();
  const { ballot: ballotOriginal } = resultOriginal.unsafeUnwrap();
  expect(ballotFlipped).toMatchSnapshot();
  expect(ballotFlipped).toEqual(ballotOriginal);

  // don't use Jest `toEqual` matcher because it tries to pretty print the
  // ImageData objects, which is slow and causes the test to time out
  assert(
    blankPageImageFlipped.data.every(
      (value, idx) => value === cardFlipped[1].data[idx]
    )
  );

  // Visually ensure that the snapshot represents a properly oriented ballot
  const canvas = createCanvas(
    summaryBallotImageFlipped.width,
    summaryBallotImageFlipped.height
  );
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.putImageData(summaryBallotImageFlipped, 0, 0);
  const ballotImage = canvas.toBuffer('image/png');
  expect(ballotImage).toMatchImageSnapshot();
});

test('happy path: back, front upside down', async () => {
  const cardFlipped = famousNamesBmdBallotUpsideDown;
  const cardOriginal = famousNamesBmdBallot;
  const resultFlipped = await interpret(
    electionFamousNames.toElectionDefinition(),
    [cardFlipped[1], copyImageData(cardFlipped[0])]
  );
  const resultOriginal = await interpret(
    electionFamousNames.toElectionDefinition(),
    cardOriginal
  );
  const {
    ballot: ballotFlipped,
    summaryBallotImage: summaryBallotImageFlipped,
    blankPageImage: blankPageImageFlipped,
  } = resultFlipped.unsafeUnwrap();
  const { ballot: ballotOriginal } = resultOriginal.unsafeUnwrap();
  expect(ballotFlipped).toMatchSnapshot();
  expect(ballotFlipped).toEqual(ballotOriginal);

  // don't use Jest `toEqual` matcher because it tries to pretty print the
  // ImageData objects, which is slow and causes the test to time out
  assert(
    blankPageImageFlipped.data.every(
      (value, idx) => value === cardFlipped[1].data[idx]
    )
  );

  const canvas = createCanvas(
    summaryBallotImageFlipped.width,
    summaryBallotImageFlipped.height
  );

  // Visually ensure that the snapshot represents a properly oriented ballot
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.putImageData(summaryBallotImageFlipped, 0, 0);
  const ballotImage = canvas.toBuffer('image/png');
  expect(ballotImage).toMatchImageSnapshot();
});

test('votes not found', async () => {
  const card: SheetOf<ImageData> = [
    await sampleBallotImages.blankPage.asImageData(),
    await sampleBallotImages.blankPage.asImageData(),
  ];
  const result = await interpret(
    electionFamousNames.toElectionDefinition(),
    card
  );
  expect(result).toEqual<InterpretResult>(
    err({
      type: 'votes-not-found',
      source: [{ type: 'blank-page' }, { type: 'blank-page' }],
    })
  );
});

test('multiple QR codes', async () => {
  const [page1] = famousNamesBmdBallot;
  const card: SheetOf<ImageData> = [page1, page1];
  const result = await interpret(
    electionFamousNames.toElectionDefinition(),
    card
  );
  expect(result).toEqual<InterpretResult>(
    err({
      type: 'multiple-qr-codes',
      source: expect.anything(),
    })
  );
});

test('mismatched election', async () => {
  const card = famousNamesBmdBallot;
  const result = await interpret(
    electionGridLayoutNewHampshire.toElectionDefinition(),
    card
  );
  expect(result).toEqual<InterpretResult>(
    err({
      type: 'mismatched-election',
      expectedBallotHash: sliceBallotHashForEncoding(
        electionGridLayoutNewHampshire.toElectionDefinition().ballotHash
      ),
      actualBallotHash: sliceBallotHashForEncoding(
        electionFamousNames.toElectionDefinition().ballotHash
      ),
    })
  );
});
