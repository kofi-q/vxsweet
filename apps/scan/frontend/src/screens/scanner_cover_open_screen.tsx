import { CenteredLargeProse, H1, P, appStrings } from '@vx/libs/ui/src';
import { ScreenMainCenterChild } from '../components/layout';

export function ScannerCoverOpenScreen(): JSX.Element {
  return (
    <ScreenMainCenterChild voterFacing>
      <CenteredLargeProse>
        <H1>{appStrings.titleScannerCoverIsOpen()}</H1>
        <P>{appStrings.instructionsAskForHelp()}</P>
      </CenteredLargeProse>
    </ScreenMainCenterChild>
  );
}
