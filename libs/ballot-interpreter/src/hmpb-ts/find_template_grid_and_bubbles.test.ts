import { ImageData } from 'canvas';
import { err } from '@vx/libs/basics/result';
import * as sampleBallotImages from '@vx/libs/fixtures/src/data/sample-ballot-images';
import * as electionGridLayoutNewHampshireTestBallotFixtures from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot';
import { type SheetOf } from '@vx/libs/types/elections';
import { findTemplateGridAndBubbles } from './find_template_grid_and_bubbles';
import { type TimingMarkGrid } from './types';

test('find layout from template images', async () => {
  const ballotImages: SheetOf<ImageData> = [
    await electionGridLayoutNewHampshireTestBallotFixtures.templateFront.asImageData(),
    await electionGridLayoutNewHampshireTestBallotFixtures.templateBack.asImageData(),
  ];

  const [front, back] = findTemplateGridAndBubbles(ballotImages).unsafeUnwrap();

  // the particulars of the grid are tested in template.rs
  expect([front, back]).toEqual<SheetOf<TimingMarkGrid>>([
    expect.any(Object),
    expect.any(Object),
  ]);
  expect(front.metadata.side).toEqual('front');
  expect(back.metadata.side).toEqual('back');
  expect(front.bubbles).toBeDefined();
  expect(back.bubbles).toBeDefined();
});

test('returns Err on error', async () => {
  const ballotImages: SheetOf<ImageData> = [
    await sampleBallotImages.notBallot.asImageData(),
    await sampleBallotImages.notBallot.asImageData(),
  ];

  expect(findTemplateGridAndBubbles(ballotImages)).toEqual(
    err(expect.anything())
  );
});
