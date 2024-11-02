import { CenteredLargeProse, H1, P } from '@vx/libs/ui/src';
import { appStrings } from '@vx/libs/ui/src/ui_strings';
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
