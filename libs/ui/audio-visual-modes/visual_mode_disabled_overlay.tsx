import React from 'react';
import styled from 'styled-components';
import { VoterSettingsManagerContext } from '../themes/voter_settings_manager_context';
import { Button } from '../buttons/button';
import { appStrings } from '../ui_strings/ui_string/app_strings';
import { H2 } from '../primitives/typography';
import { useScreenInfo } from '../themes/use_screen_info';
import { Header } from '../voter_settings/header';
import { useCurrentTheme } from '../themes/use_current_theme';

const Overlay = styled.div`
  position: fixed;
  height: 100%;
  width: 100%;
  z-index: 1000;
  left: 0;
  top: 0;
  background: #fff;
  padding: 1em;
`;

const ButtonContainer = styled.div`
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
`;

export function VisualModeDisabledOverlay(): JSX.Element | null {
  const voterSettingsManager = React.useContext(VoterSettingsManagerContext);
  const screenInfo = useScreenInfo();
  const currentTheme = useCurrentTheme();

  if (!currentTheme.isVisualModeDisabled) {
    return null;
  }

  return (
    <Overlay aria-hidden>
      <Header portrait={screenInfo.isPortrait}>
        <H2 as="h1">{appStrings.titleAudioOnlyModeEnabled()}</H2>
      </Header>
      <ButtonContainer>
        <Button
          icon="Eye"
          variant="primary"
          onPress={() => {
            voterSettingsManager.setIsVisualModeDisabled(false);
          }}
        >
          {appStrings.buttonExitAudioOnlyMode()}
        </Button>
      </ButtonContainer>
    </Overlay>
  );
}
