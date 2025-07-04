import React from 'react';
import { H1, P, Icons } from '@vx/libs/ui/primitives';
import { Button } from '@vx/libs/ui/buttons';
import { ReadOnLoad } from '@vx/libs/ui/ui_strings';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { VoterScreen } from '@vx/libs/mark-flow-ui/src';
import { PortraitStepInnerContainer } from './portrait_step_inner_container';

interface Props {
  onPressBack: () => void;
  onPressContinue: () => void;
  nextButtonLabel?: JSX.Element;
  description?: JSX.Element;
}

export function ConfirmExitPatDeviceIdentificationPage({
  onPressBack,
  onPressContinue,
  nextButtonLabel,
  description,
}: Props): JSX.Element {
  return (
    <VoterScreen
      centerContent
      actionButtons={
        <React.Fragment>
          <Button icon="Previous" onPress={onPressBack}>
            {appStrings.buttonBack()}
          </Button>
          <Button variant="primary" rightIcon="Next" onPress={onPressContinue}>
            {nextButtonLabel ?? appStrings.buttonContinueVoting()}
          </Button>
        </React.Fragment>
      }
    >
      <PortraitStepInnerContainer>
        <ReadOnLoad>
          <Icons.Done color="success" />
          <H1>{appStrings.titleBmdPatCalibrationConfirmExitScreen()}</H1>
          <P>
            {description ??
              appStrings.instructionsBmdPatCalibrationConfirmExitScreen()}
          </P>
        </ReadOnLoad>
      </PortraitStepInnerContainer>
    </VoterScreen>
  );
}
