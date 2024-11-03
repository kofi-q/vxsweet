import React from 'react';

import { useCurrentLanguage } from '../ui_strings/use_current_language';
import { useAvailableLanguages } from '../ui_strings/use_available_languages';
import { Button } from '../buttons/button';
import { appStrings } from '../ui_strings/ui_string/app_strings';
import { electionStrings } from '../ui_strings/ui_string/election_strings';
import { LanguageOverride } from '../ui_strings/language_context/language_override';
import { WithAltAudio } from '../ui_strings/with_alt_audio';

export interface LanguageSettingsButtonProps {
  onPress: () => void;
}

export function LanguageSettingsButton(
  props: LanguageSettingsButtonProps
): React.ReactNode {
  const { onPress } = props;
  const currentLanguageCode = useCurrentLanguage();
  const availableLanguages = useAvailableLanguages();

  if (availableLanguages.length < 2) {
    return null;
  }

  const otherLanguageCodes = availableLanguages.filter(
    (l) => l !== currentLanguageCode
  );

  const altAudioText = (
    <React.Fragment>
      <span>
        {appStrings.labelCurrentLanguage()}{' '}
        {electionStrings.ballotLanguage(currentLanguageCode)}
      </span>
      <span>{appStrings.instructionsLanguageSettingsButton()}</span>
      <span>
        {otherLanguageCodes.map((l) => (
          <LanguageOverride key={l} languageCode={l}>
            {appStrings.instructionsLanguageSettingsButton()}
          </LanguageOverride>
        ))}
      </span>
    </React.Fragment>
  );

  return (
    <Button icon="Globe" onPress={onPress}>
      <WithAltAudio audioText={altAudioText}>
        {electionStrings.ballotLanguage(currentLanguageCode)}
      </WithAltAudio>
    </Button>
  );
}
