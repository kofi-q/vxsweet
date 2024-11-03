import { Caption, H1 } from '@vx/libs/ui/primitives';
import { CenteredLargeProse } from '@vx/libs/ui/src';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { ScreenMainCenterChild } from '../../components/layout/layout';

export function ScanReturnedBallotScreen(): JSX.Element {
  return (
    <ScreenMainCenterChild voterFacing>
      {/* TODO: make a graphic for this screen */}
      <CenteredLargeProse>
        <H1>{appStrings.titleRemoveYourBallot()}</H1>
        <Caption>{appStrings.noteAskPollWorkerForHelp()}</Caption>
      </CenteredLargeProse>
    </ScreenMainCenterChild>
  );
}

/* istanbul ignore next */
export function DefaultPreview(): JSX.Element {
  return <ScanReturnedBallotScreen />;
}
