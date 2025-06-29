import { type Optional } from '@vx/libs/basics/types';
import { type Election } from '@vx/libs/types/elections';

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
