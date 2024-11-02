import React from 'react';

import { type UiStringsReactQueryApi } from '../api/ui_strings_api';
import { FrontendLanguageContextProvider } from '../language_context/language_context';
import { UiStringsAudioContextProvider } from '../audio-context/audio_context';
import { UiStringScreenReader } from '../screen-reader/ui_string_screen_reader';
import { KeyboardShortcutHandlers } from '../keyboard-shortcuts/keyboard_shortcut_handlers';

export interface UiStringsContextProviderProps {
  api: UiStringsReactQueryApi;
  children: React.ReactNode;
  disabled?: boolean;
  noAudio?: boolean;
}

export function UiStringsContextProvider(
  props: UiStringsContextProviderProps
): React.ReactNode {
  const { api, children, disabled, noAudio } = props;

  if (disabled) {
    return children;
  }

  const content = (
    <React.Fragment>
      <KeyboardShortcutHandlers />
      {children}
    </React.Fragment>
  );

  return (
    <FrontendLanguageContextProvider api={api}>
      {noAudio ? (
        content
      ) : (
        <UiStringsAudioContextProvider api={api}>
          <UiStringScreenReader>{content}</UiStringScreenReader>
        </UiStringsAudioContextProvider>
      )}
    </FrontendLanguageContextProvider>
  );
}
