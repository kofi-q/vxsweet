import { ImageData } from 'canvas';
import { type Result, err, ok } from '@vx/libs/basics/result';
import { type SheetOf } from '@vx/libs/types/elections';
import { findTemplateGridAndBubbles as findTemplateGridAndBubblesImpl } from './rust_addon';
import {
  type BallotPageTimingMarkMetadata,
  type Point,
  type TimingMarkGrid,
  type u32,
} from './types';

/**
 * The result of calling {@link findTemplateGridAndBubbles}.
 */
export type TemplateGridAndBubbles = SheetOf<{
  grid: TimingMarkGrid;
  bubbles: Array<Point<u32>>;
  metadata: BallotPageTimingMarkMetadata;
}>;

/**
 * Finds the timing mark grid layout and bubbles of a ballot card template. Does
 * not interpret.
 */
export function findTemplateGridAndBubbles(
  ballotImages: SheetOf<ImageData>
): Result<TemplateGridAndBubbles, unknown> {
  try {
    return ok(findTemplateGridAndBubblesImpl(ballotImages[0], ballotImages[1]));
  } catch (error) {
    return err(error);
  }
}
