import React from 'react';
import styled from 'styled-components';

import { type Align, Font } from '@vx/libs/ui/primitives';
import { Main, Screen } from '@vx/libs/ui/screens';
import { ReadOnLoad as ReadOnLoadBase } from '@vx/libs/ui/ui_strings';
import { VoterScreen, ButtonFooter } from '@vx/libs/mark-flow-ui/src';

export interface CenteredPageLayoutProps {
  buttons?: React.ReactNode;
  children: React.ReactNode;
  voterFacing: boolean;
  textAlign?: Align;
}

const ReadOnLoad = styled(ReadOnLoadBase)`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const Content = styled(Font)`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

export function CenteredPageLayout(
  props: CenteredPageLayoutProps
): JSX.Element {
  const { buttons, children, textAlign, voterFacing } = props;

  const mainContent = (
    <Content align={textAlign || 'center'}>{children}</Content>
  );

  if (voterFacing) {
    return (
      <VoterScreen actionButtons={buttons} centerContent padded>
        <ReadOnLoad>{mainContent}</ReadOnLoad>
      </VoterScreen>
    );
  }

  return (
    <Screen>
      <Main padded centerChild>
        {mainContent}
      </Main>
      {buttons && <ButtonFooter>{buttons}</ButtonFooter>}
    </Screen>
  );
}
