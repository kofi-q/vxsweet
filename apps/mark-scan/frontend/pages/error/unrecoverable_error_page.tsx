import { P, Icons } from '@vx/libs/ui/primitives';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { CenteredCardPageLayout } from '../../components/centered_card_page_layout';

export function UnrecoverableErrorPage(): JSX.Element {
  return (
    <CenteredCardPageLayout
      icon={<Icons.Warning color="warning" />}
      title={appStrings.unrecoverableError()}
      voterFacing
    >
      <P>{appStrings.instructionsBmdAskForRestart()}</P>
    </CenteredCardPageLayout>
  );
}
