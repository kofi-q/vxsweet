import React from 'react';

import { assertDefined } from '@vx/libs/basics/assert';
import { type PageInterpretationType } from '@vx/libs/types/src';

import * as api from '../../api/api';
import { ReinsertedNonBallotScreen } from './non_ballot';
import { ReinsertedWrongElectionBallotScreen } from './wrong_election';
import { ReinsertedWrongTestModeBallotScreen } from './wrong_test_mode';
import { ReinsertedWrongPrecinctBallotScreen } from './wrong_precinct';

const SCREENS: Readonly<
  Record<PageInterpretationType, JSX.Element | undefined>
> = {
  InterpretedBmdPage: undefined, // This page should be unreachable for this result.

  BlankPage: <ReinsertedNonBallotScreen />,
  InterpretedHmpbPage: <ReinsertedNonBallotScreen />,
  InvalidBallotHashPage: <ReinsertedWrongElectionBallotScreen />,
  InvalidPrecinctPage: <ReinsertedWrongPrecinctBallotScreen />,
  InvalidTestModePage: <ReinsertedWrongTestModeBallotScreen />,
  UnreadablePage: <ReinsertedNonBallotScreen />,
};

export function ReinsertedInvalidBallotScreen(): React.ReactNode {
  const interpretationQuery = api.getInterpretation.useQuery();

  if (!interpretationQuery.isSuccess) {
    return null;
  }

  const interpretationType = assertDefined(interpretationQuery.data).type;
  const screen = assertDefined(
    SCREENS[interpretationType],
    `unexpected interpretation type: ${interpretationType}`
  );

  return screen;
}
