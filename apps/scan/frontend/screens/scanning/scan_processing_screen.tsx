import { CenteredLargeProse } from '@vx/libs/ui/src';
import { LoadingAnimation } from '@vx/libs/ui/spinners';
import { H1, P } from '@vx/libs/ui/primitives';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { ScreenMainCenterChild } from '../../components/layout/layout';

export function ScanProcessingScreen(): JSX.Element {
  return (
    <ScreenMainCenterChild voterFacing>
      <LoadingAnimation />
      <CenteredLargeProse>
        <H1>{appStrings.titleScannerProcessingScreen()}</H1>
        <P>{appStrings.noteScannerScanInProgress()}</P>
      </CenteredLargeProse>
    </ScreenMainCenterChild>
  );
}

/* istanbul ignore next */
export function DefaultPreview(): JSX.Element {
  return <ScanProcessingScreen />;
}
