import React, { useContext } from 'react';
import { assert } from '@vx/libs/basics/src';
import { Icons, P, useCurrentLanguage } from '@vx/libs/ui/src';
import { appStrings } from '@vx/libs/ui/src/ui_strings';
import { BallotContext } from '../../contexts/ballot_context';
import { printBallot } from '../../api/api';
import { CenteredCardPageLayout } from '../../components/centered_card_page_layout';

export function PrintPage(): JSX.Element | null {
  const { ballotStyleId, precinctId, votes } = useContext(BallotContext);
  const languageCode = useCurrentLanguage();
  const printBallotMutate = printBallot.useMutation().mutate;

  React.useEffect(() => {
    assert(ballotStyleId !== undefined);
    assert(precinctId !== undefined);

    printBallotMutate({
      languageCode,
      precinctId,
      ballotStyleId,
      votes,
    });

    // No re-triggering deps - we only want to run this once on first render:
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CenteredCardPageLayout
      icon={<Icons.Info />}
      title={appStrings.titleBmdPrintScreen()}
      voterFacing
    >
      <P>{appStrings.instructionsBmdPrintScreenNoBallotRemoval()}</P>
      <P>{appStrings.noteBmdPrintedBallotReviewNextSteps()}</P>
    </CenteredCardPageLayout>
  );
}
