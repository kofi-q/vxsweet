import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { Icons, P } from '@vx/libs/ui/primitives';

import { CenteredCardPageLayout } from '../../components/centered_card_page_layout';

export function LoadingReinsertedBallotScreen(): JSX.Element {
  return (
    <CenteredCardPageLayout
      icon={<Icons.Info />}
      title={appStrings.titleBmdLoadingReinsertedBallotScreen()}
      voterFacing
    >
      <P>{appStrings.noteBmdScanningReinsertedBallot()}</P>
      <P>{appStrings.noteBmdPrintedBallotReviewNextSteps()}</P>
    </CenteredCardPageLayout>
  );
}
