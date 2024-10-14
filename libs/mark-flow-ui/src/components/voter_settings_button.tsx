import { Button, appStrings } from '@vx/libs/ui/src';

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
