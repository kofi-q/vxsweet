import styled from 'styled-components';
import React from 'react';
import { SettingsPane } from './settings_pane';
import { Button } from '../buttons/button';
import { VoterSettingsManagerContext } from '../themes/voter_settings_manager_context';
import { appStrings } from '../ui_strings/ui_string/app_strings';
import { ToggleAudioButton } from '../ui_strings/audio-controls/toggle_audio_button';
import { useAudioControls } from '../ui_strings/screen-reader/use_audio_controls';
import { useCurrentTheme } from '../themes/use_current_theme';

const Buttons = styled.div`
  align-items: start;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

export interface AudioSettingsProps {
  onEnterAudioOnlyMode: () => void;
}

export function AudioSettings(props: AudioSettingsProps): JSX.Element {
  const { onEnterAudioOnlyMode } = props;
  const { setIsVisualModeDisabled } = React.useContext(
    VoterSettingsManagerContext
  );
  const { setIsEnabled: setAudioEnabled } = useAudioControls();
  const { isVisualModeDisabled } = useCurrentTheme();

  const onAudioOnlyPress = React.useCallback(() => {
    if (!isVisualModeDisabled) {
      // If we're about to enable audio-only mode, make sure audio is unmuted:
      setAudioEnabled(true);
    }

    setIsVisualModeDisabled(!isVisualModeDisabled);
    onEnterAudioOnlyMode();
  }, [
    isVisualModeDisabled,
    onEnterAudioOnlyMode,
    setAudioEnabled,
    setIsVisualModeDisabled,
  ]);

  return (
    <SettingsPane id="voterSettingsAudio">
      <Buttons>
        <ToggleAudioButton />
        <Button
          icon={isVisualModeDisabled ? 'Eye' : 'EyeSlash'}
          onPress={onAudioOnlyPress}
        >
          {isVisualModeDisabled
            ? appStrings.buttonExitAudioOnlyMode()
            : appStrings.buttonEnableAudioOnlyMode()}
        </Button>
      </Buttons>
    </SettingsPane>
  );
}
