import styled from 'styled-components';

import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { type SizeMode } from '@vx/libs/types/ui-theme';
import { ContestList } from './contest_list';
import { useLayoutConfig } from './use_layout_config_hook';
import { type MisvoteWarningsProps } from './types';

interface ContainerProps {
  numCardsPerRow: number;
}

const CONTENT_SPACING_VALUES_REM: Readonly<Record<SizeMode, number>> = {
  desktop: 0.5, // unused
  print: 0.5, // unused
  touchSmall: 0.5,
  touchMedium: 0.5,
  touchLarge: 0.25,
  touchExtraLarge: 0.25,
};

const Container = styled.div<ContainerProps>`
  display: grid;
  flex-direction: column;
  grid-template-columns: repeat(${(p) => p.numCardsPerRow}, 1fr);
  grid-gap: ${(p) => CONTENT_SPACING_VALUES_REM[p.theme.sizeMode]}rem;
`;

export function WarningDetails(props: MisvoteWarningsProps): JSX.Element {
  const { blankContests, overvoteContests, partiallyVotedContests } = props;
  const layout = useLayoutConfig(props);

  return (
    <Container numCardsPerRow={layout.numCardsPerRow}>
      {blankContests.length > 0 && (
        <ContestList
          contests={blankContests}
          maxColumns={layout.maxColumnsPerCard}
          title={appStrings.titleScannerNoVotesWarning()}
          helpNote={
            blankContests.length === 1
              ? appStrings.noteScannerBlankContestsCardSingular()
              : appStrings.noteScannerBlankContestsCardPlural()
          }
        />
      )}

      {partiallyVotedContests.length > 0 && (
        <ContestList
          contests={partiallyVotedContests}
          maxColumns={layout.maxColumnsPerCard}
          title={appStrings.titleScannerUndervoteWarning()}
          helpNote={
            partiallyVotedContests.length === 1
              ? appStrings.noteScannerUndervoteContestsCardSingular()
              : appStrings.noteScannerUndervoteContestsCardPlural()
          }
        />
      )}

      {overvoteContests.length > 0 && (
        <ContestList
          contests={overvoteContests}
          maxColumns={layout.maxColumnsPerCard}
          title={appStrings.titleScannerOvervoteWarning()}
          helpNote={
            overvoteContests.length === 1
              ? appStrings.noteScannerOvervoteContestsCardSingular()
              : appStrings.noteScannerOvervoteContestsCardPlural()
          }
        />
      )}
    </Container>
  );
}
