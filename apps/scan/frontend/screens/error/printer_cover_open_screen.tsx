import { CenteredLargeProse } from '@vx/libs/ui/src';
import { H1, P } from '@vx/libs/ui/primitives';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { ScreenMainCenterChild } from '../../components/layout/layout';

export function PrinterCoverOpenScreen(): JSX.Element {
  return (
    <ScreenMainCenterChild voterFacing>
      <CenteredLargeProse>
        <H1>{appStrings.titlePrinterCoverIsOpen()}</H1>
        <P>{appStrings.instructionsAskForHelp()}</P>
      </CenteredLargeProse>
    </ScreenMainCenterChild>
  );
}
