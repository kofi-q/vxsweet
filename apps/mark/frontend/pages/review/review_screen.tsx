import { useContext } from 'react';
import { useHistory } from 'react-router-dom';

import { ReviewPage } from '@vx/libs/mark-flow-ui/src';

import { BallotContext } from '../../contexts/ballot_context';

export function ReviewScreen(): JSX.Element {
  const history = useHistory();
  const { contests, electionDefinition, precinctId, votes } =
    useContext(BallotContext);

  return (
    <ReviewPage
      contests={contests}
      electionDefinition={electionDefinition}
      precinctId={precinctId}
      printScreenUrl="/print"
      returnToContest={(contestId) => {
        history.push(
          `/contests/${contests.findIndex(({ id }) => id === contestId)}#review`
        );
      }}
      votes={votes}
    />
  );
}
