import { appStrings, Icons, P } from '@vx/libs/ui/src';
import { CenteredCardPageLayout } from '../components/centered_card_page_layout';

export function PollWorkerAuthEndedUnexpectedlyPage(): JSX.Element {
  return (
    <CenteredCardPageLayout
      icon={<Icons.Warning />}
      title={appStrings.noteBmdSessionRestart()}
      voterFacing={false}
    >
      <P>
        The poll worker card was removed before paper loading completed. Please
        try again.
      </P>
    </CenteredCardPageLayout>
  );
}
