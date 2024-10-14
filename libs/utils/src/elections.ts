import { Optional } from '@vx/libs/basics/src';
import { Election } from '@vx/libs/types/src';

export function getMaxSheetsPerBallot(election: Election): Optional<number> {
  if (!election.gridLayouts) {
    return undefined;
  }

  return Math.max(
    ...election.gridLayouts
      .flatMap((gridLayout) => gridLayout.gridPositions)
      .map(({ sheetNumber }) => sheetNumber)
  );
}
