import { IdlePage as MarkFlowIdlePage } from '@vx/libs/mark-flow-ui/src';
import { useContext } from 'react';
import { BallotContext } from '../../contexts/ballot_context';

export function IdlePage(): JSX.Element {
  const { endVoterSession, resetBallot } = useContext(BallotContext);

  async function reset() {
    await endVoterSession();
    resetBallot();
  }

  return <MarkFlowIdlePage onCountdownEnd={reset} />;
}
