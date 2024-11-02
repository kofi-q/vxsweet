import React from 'react';

import {
  type AppStringKey,
  appStrings,
} from '../ui_strings/ui_string/app_strings';
import { AudioOnly } from '../ui_strings/audio_only';
import { ReadOnLoad } from '../ui_strings/read_on_load';
import { Keybinding } from '../keybindings/keybindings';
import { Screen } from '../screens/screen';
import { Main } from '../screens/main';
import { useAudioControls } from '../ui_strings/screen-reader/use_audio_controls';
import { H1 } from '../primitives/typography';

export type AccessibleControllerType = 'mark' | 'markScan';

export interface AccessibleControllerIllustrationProps<T extends Keybinding> {
  highlight?: T;
}

export type AccessibleControllerHelpStrings<T extends Keybinding> = Readonly<
  Record<T, AppStringKey | null>
>;

export interface AccessibleControllerSandboxProps<T extends Keybinding> {
  feedbackStringKeys: AccessibleControllerHelpStrings<T>;
  illustration: (
    props: AccessibleControllerIllustrationProps<T>
  ) => JSX.Element;
  introAudioStringKey: AppStringKey;
}

export function AccessibleControllerSandbox<T extends Keybinding>(
  props: AccessibleControllerSandboxProps<T>
): JSX.Element {
  const { feedbackStringKeys, illustration, introAudioStringKey } = props;

  const [pressedKey, setPressedKey] = React.useState<T>();
  const [currentAudioStringKey, setCurrentAudioStringKey] =
    React.useState<AppStringKey>();

  const audioControls = useAudioControls();
  const setAudioControlsEnabled = audioControls.setControlsEnabled;
  const setAudioEnabled = audioControls.setIsEnabled;

  React.useEffect(() => {
    setAudioEnabled(true);
    setAudioControlsEnabled(false);

    return () => setAudioControlsEnabled(true);
  }, [setAudioControlsEnabled, setAudioEnabled]);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      setPressedKey(undefined);
      setCurrentAudioStringKey(undefined);

      const key = event.key as T;
      const audioStringKey = feedbackStringKeys[key];
      if (!audioStringKey) {
        return;
      }

      // Waiting to update the audio string key in the next tick allows the
      // previous state to get cleared and for the screen reader to stop before
      // triggering new audio. This enables repeated audio feedback on repeated
      // presses of the same button.
      window.setTimeout(() => {
        setPressedKey(key);
        setCurrentAudioStringKey(audioStringKey);
      });
    }

    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [feedbackStringKeys]);

  const Illustration = illustration;

  return (
    <Screen>
      <Main centerChild padded>
        <H1>Controller Help</H1>
        <ReadOnLoad>
          <AudioOnly>{appStrings[introAudioStringKey]()}</AudioOnly>
        </ReadOnLoad>
        <Illustration highlight={pressedKey} />
        {currentAudioStringKey && (
          <ReadOnLoad key={currentAudioStringKey}>
            <AudioOnly>{appStrings[currentAudioStringKey]()}</AudioOnly>
          </ReadOnLoad>
        )}
      </Main>
    </Screen>
  );
}
