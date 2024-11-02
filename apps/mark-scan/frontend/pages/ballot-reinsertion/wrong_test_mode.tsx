import React from 'react';

import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { Caption, Icons, P } from '@vx/libs/ui/primitives';

import { assert, assertDefined } from '@vx/libs/basics/src';
import * as api from '../../api/api';
import { CenteredCardPageLayout } from '../../components/centered_card_page_layout';

export function ReinsertedWrongTestModeBallotScreen(): React.ReactNode {
  const interpretationQuery = api.getInterpretation.useQuery();

  if (!interpretationQuery.isSuccess) {
    return null;
  }

  const interpretation = assertDefined(interpretationQuery.data);
  assert(interpretation.type === 'InvalidTestModePage');

  return (
    <CenteredCardPageLayout
      icon={<Icons.Warning color="warning" />}
      title={appStrings.titleBmdInvalidBallotWrongTestMode()}
      voterFacing
    >
      <P>
        {interpretation.metadata.isTestMode
          ? appStrings.warningBmdInvalidBallotTestBallotInLiveMode()
          : appStrings.warningBmdInvalidBallotLiveBallotInTestMode()}
      </P>
      <P>{appStrings.instructionsBmdInsertPreviouslyPrintedBallot()}</P>
      <Caption>
        <Icons.Question /> {appStrings.noteAskPollWorkerForHelp()}
      </Caption>
    </CenteredCardPageLayout>
  );
}
