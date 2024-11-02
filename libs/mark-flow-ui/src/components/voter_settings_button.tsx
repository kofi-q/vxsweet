import { Button } from '@vx/libs/ui/buttons';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';

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
