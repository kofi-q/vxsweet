import { type AnyContest } from '@vx/libs/types/elections';

export interface MisvoteWarningsProps {
  blankContests: readonly AnyContest[];
  overvoteContests: readonly AnyContest[];
  partiallyVotedContests: readonly AnyContest[];
}

export interface MisvoteWarningsConfig {
  maxCardsPerRow: number;
  maxColumnsPerCard: number;
  maxPreviewContestRows: number;
}

export interface Layout {
  maxColumnsPerCard: number;
  numCardsPerRow: number;
  showSummaryInPreview?: boolean;
}
