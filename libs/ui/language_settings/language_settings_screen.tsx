import React from 'react';
import styled, { DefaultTheme } from 'styled-components';

import { type SizeMode } from '@vx/libs/types/ui-theme';

import { Screen } from '../screens/screen';
import { Button } from '../buttons/button';
import { AudioOnly } from '../ui_strings/audio_only';
import { ReadOnLoad } from '../ui_strings/read_on_load';
import { appStrings } from '../ui_strings/ui_string/app_strings';
import { electionStrings } from '../ui_strings/ui_string/election_strings';
import { useCurrentLanguage } from '../ui_strings/use_current_language';
import { useAvailableLanguages } from '../ui_strings/use_available_languages';
import { useLanguageControls } from '../ui_strings/use_language_controls';
import { H2 } from '../primitives/typography';
import { RadioGroup } from '../radio_group/radio_group';
import { DEFAULT_LANGUAGE_CODE } from '../ui_strings/language_context/language_context';
import { useScreenInfo } from '../themes/use_screen_info';
import { WithScrollButtons } from '../touch-controls/with_scroll_buttons';
import { PageNavigationButtonId } from '../accessible_controllers/navigation';
import { AssistiveTechInstructions } from '../accessible_controllers/assistive_tech_instructions';

export interface LanguageSettingsScreenProps {
  onDone: () => void;
}

const COMPACT_SIZE_MODES = new Set<SizeMode>(['touchExtraLarge']);

/* istanbul ignore next - presentational */
function getSpacingRem(p: { theme: DefaultTheme }) {
  return COMPACT_SIZE_MODES.has(p.theme.sizeMode) ? 0.3 : 0.5;
}

const Header = styled.div`
  padding: ${(p) => getSpacingRem(p)}rem;
`;

const RadioGroupContainer = styled.div`
  padding: ${(p) => getSpacingRem(p)}rem;
`;

const Buttons = styled.div`
  display: flex;
  gap: ${(p) => getSpacingRem(p)}rem;
  justify-content: end;
  padding: ${(p) => getSpacingRem(p)}rem;
`;

export function LanguageSettingsScreen(
  props: LanguageSettingsScreenProps
): JSX.Element {
  const { onDone } = props;

  const screenInfo = useScreenInfo();
  const currentLanguageCode = useCurrentLanguage();
  const availableLanguages = useAvailableLanguages();
  const { setLanguage } = useLanguageControls();

  function getOptionLabel(languageCode: string) {
    const selectedPrefix =
      languageCode === currentLanguageCode ? (
        <AudioOnly>{appStrings.labelSelected()} </AudioOnly>
      ) : null;

    return (
      <React.Fragment>
        {selectedPrefix}
        {electionStrings.ballotLanguage(languageCode)}
      </React.Fragment>
    );
  }

  const orderedLanguageCodes: string[] = [
    DEFAULT_LANGUAGE_CODE,
    // TODO(kofi); We'll likely want a way for election officials to specify an
    // ordering for the other languages.
    ...availableLanguages.filter((l) => l !== DEFAULT_LANGUAGE_CODE),
  ];

  return (
    <Screen>
      <Header>
        <ReadOnLoad>
          <H2 as="h1">{appStrings.titleLanguageSettingsScreen()}</H2>
          <AudioOnly>
            <AssistiveTechInstructions
              controllerString={appStrings.instructionsLanguageSettingsScreen()}
              patDeviceString={appStrings.instructionsLanguageSettingsScreenPatDevice()}
            />
          </AudioOnly>
        </ReadOnLoad>
      </Header>
      <WithScrollButtons noPadding>
        <RadioGroupContainer>
          <RadioGroup
            hideLabel
            label="Available Languages"
            numColumns={
              /* istanbul ignore next - presentational */
              screenInfo.isPortrait ? 1 : 2
            }
            onChange={setLanguage}
            options={orderedLanguageCodes.map((languageCode) => ({
              label: getOptionLabel(languageCode),
              value: languageCode,
            }))}
            value={currentLanguageCode}
          />
        </RadioGroupContainer>
      </WithScrollButtons>
      <Buttons>
        <Button
          icon="Done"
          id={PageNavigationButtonId.NEXT}
          onPress={onDone}
          variant="primary"
        >
          {appStrings.buttonDone()}
        </Button>
      </Buttons>
    </Screen>
  );
}
