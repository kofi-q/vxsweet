import {
  type InterpretedBmdPage,
  type InterpretedHmpbPage,
  type InvalidPrecinctPage,
  type InvalidTestModePage,
  type PageInterpretation,
} from '@vx/libs/types/scanning';

import { type InterpreterOptions } from './types';

type PageInterpretationWithMetadata =
  | InterpretedBmdPage
  | InterpretedHmpbPage
  | InvalidTestModePage
  | InvalidPrecinctPage;

function setTestMode<T extends PageInterpretationWithMetadata>(
  interpretation: T,
  isTestMode: boolean
): T {
  return {
    // eslint-disable-next-line vx/gts-spread-like-types
    ...interpretation,
    metadata: {
      ...interpretation.metadata,
      isTestMode,
    },
  };
}

export function normalizeBallotMode(
  interpretation: PageInterpretation,
  options: InterpreterOptions
): PageInterpretation {
  if (
    'metadata' in interpretation &&
    options.testMode &&
    options.allowOfficialBallotsInTestMode
  ) {
    return setTestMode(interpretation, true);
  }

  return interpretation;
}
