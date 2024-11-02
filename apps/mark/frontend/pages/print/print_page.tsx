import { useContext, useEffect, useRef } from 'react';
import { PrintPage as MarkFlowPrintPage } from '@vx/libs/mark-flow-ui/src';
import { assert } from '@vx/libs/basics/src';
import { useCurrentLanguage } from '@vx/libs/ui/ui_strings';
import { BallotContext } from '../../contexts/ballot_context';
import { BALLOT_PRINTING_TIMEOUT_SECONDS } from '../../config/globals';
import { printBallot } from '../../api/api';

export function PrintPage(): JSX.Element {
  const { ballotStyleId, precinctId, votes, resetBallot } =
    useContext(BallotContext);
  const languageCode = useCurrentLanguage();
  const printBallotMutation = printBallot.useMutation();

  const printerTimer = useRef(0);

  function print() {
    assert(ballotStyleId !== undefined);
    assert(precinctId !== undefined);
    printBallotMutation.mutate({
      languageCode,
      precinctId,
      ballotStyleId,
      votes,
    });

    printerTimer.current = window.setTimeout(() => {
      resetBallot(true);
    }, BALLOT_PRINTING_TIMEOUT_SECONDS * 1000);
  }

  // Make sure we clean up any pending timeout on unmount
  useEffect(() => {
    return () => {
      clearTimeout(printerTimer.current);
    };
  }, []);

  return <MarkFlowPrintPage print={print} />;
}
