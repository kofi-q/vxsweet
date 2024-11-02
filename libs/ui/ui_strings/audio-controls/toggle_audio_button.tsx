import React from 'react';
import { Button } from '../../buttons/button';
import { P } from '../../primitives/typography';
import { useAudioControls } from '../screen-reader/use_audio_controls';
import { Icons } from '../../primitives/icons';
import { appStrings } from '../ui_string/app_strings';
import { WithAltAudio } from '../with_alt_audio';
import { useAudioEnabled } from './use_audio_enabled';
import { useHeadphonesPluggedIn } from '../../hooks/use_headphones_plugged_in';

export function ToggleAudioButton(): React.ReactNode {
  const isAudioEnabled = useAudioEnabled();
  const headphonesPluggedIn = useHeadphonesPluggedIn();
  const audioControls = useAudioControls();

  const statusText = isAudioEnabled ? (
    <React.Fragment>
      <Icons.SoundOn /> {appStrings.noteVoterSettingsAudioUnmuted()}
    </React.Fragment>
  ) : (
    <React.Fragment>
      <Icons.SoundOff /> {appStrings.noteVoterSettingsAudioMuted()}
    </React.Fragment>
  );

  return (
    <div>
      <P weight="bold">{statusText}</P>
      <Button
        disabled={!headphonesPluggedIn}
        onPress={audioControls.toggleEnabled}
      >
        <WithAltAudio
          audioText={
            <React.Fragment>
              {statusText} {appStrings.instructionsAudioMuteButton()}
            </React.Fragment>
          }
        >
          {headphonesPluggedIn
            ? isAudioEnabled
              ? appStrings.buttonAudioMute()
              : appStrings.buttonAudioUnmute()
            : appStrings.noteVoterSettingsAudioNoHeadphones()}
        </WithAltAudio>
      </Button>
    </div>
  );
}
