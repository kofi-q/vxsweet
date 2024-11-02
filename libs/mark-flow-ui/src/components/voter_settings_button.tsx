import { Button } from '@vx/libs/ui/src';
import { appStrings } from '@vx/libs/ui/src/ui_strings';

export interface VoterSettingsButtonProps {
  onPress: () => void;
}

export function VoterSettingsButton(
  props: VoterSettingsButtonProps
): JSX.Element {
  const { onPress } = props;

  return (
    <Button icon="Display" onPress={onPress}>
      {appStrings.buttonVoterSettings()}
    </Button>
  );
}
