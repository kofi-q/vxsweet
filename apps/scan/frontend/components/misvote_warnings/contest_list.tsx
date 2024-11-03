import styled, { DefaultTheme } from 'styled-components';

import { type AnyContest, type SizeMode } from '@vx/libs/types/src';
import { Caption, Font, Icons } from '@vx/libs/ui/primitives';
import { List, ListItem } from '@vx/libs/ui/list';
import { electionStrings } from '@vx/libs/ui/ui_strings/ui_string';
import React from 'react';

export interface ContestListProps {
  contests: readonly AnyContest[];
  helpNote: React.ReactNode;
  maxColumns: number;
  title: React.ReactNode;
}

const CONTENT_SPACING_VALUES_REM: Readonly<Record<SizeMode, number>> = {
  desktop: 0.5,
  print: 0.5,
  touchSmall: 0.5,
  touchMedium: 0.5,
  touchLarge: 0.25,
  touchExtraLarge: 0.25,
};

function getSpacingValueRem(p: { theme: DefaultTheme }) {
  return CONTENT_SPACING_VALUES_REM[p.theme.sizeMode];
}

const Container = styled.div`
  border: ${(p) => p.theme.sizes.bordersRem.hairline}rem solid
    ${(p) => p.theme.colors.outline};
  border-radius: 0.1rem;
  padding: ${(p) => getSpacingValueRem(p)}rem;
  padding-top: ${(p) => getSpacingValueRem(p) / 2}rem;
`;

const HelpNote = styled(Caption)`
  display: flex;
  gap: 0.25rem;
  line-height: 1;
  margin: 0.25rem 0 0.5rem;
`;

export function ContestList(props: ContestListProps): JSX.Element {
  const { contests, helpNote, maxColumns, title } = props;

  return (
    <Container>
      <Font weight="bold">{title}</Font>
      <HelpNote weight="semiBold">
        <Icons.Info />
        <span>{helpNote}</span>
      </HelpNote>
      <List maxColumns={maxColumns}>
        {contests.map((c) => (
          <Caption key={c.id}>
            <ListItem>{electionStrings.contestTitle(c)}</ListItem>
          </Caption>
        ))}
      </List>
    </Container>
  );
}
