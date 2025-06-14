import React from 'react';
import styled from 'styled-components';

import { AudioOnly, NumberString, ReadOnLoad } from '@vx/libs/ui/ui_strings';
import { appStrings, electionStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { Caption, H2 } from '@vx/libs/ui/primitives';
import { type Contest, type District } from '@vx/libs/types/elections';
import { type MsEitherNeitherContest } from '../utils/ms_either_neither_contests';

export interface ContestHeaderProps {
  breadcrumbs?: BreadcrumbMetadata;
  children?: React.ReactNode;
  contest: Contest | MsEitherNeitherContest;
  district: District;
}

export interface BreadcrumbMetadata {
  ballotContestCount: number;
  contestNumber: number;
}

const Container = styled.div`
  padding: 0.25rem 0.5rem 0.5rem;
`;

export function Breadcrumbs(props: BreadcrumbMetadata): React.ReactNode {
  const { ballotContestCount, contestNumber } = props;

  return (
    <Caption noWrap>
      {appStrings.labelContestNumber()}{' '}
      <NumberString weight="bold" value={contestNumber} />
      {ballotContestCount && (
        <React.Fragment>
          {' '}
          | {appStrings.labelTotalContests()}{' '}
          <NumberString weight="bold" value={ballotContestCount} />{' '}
        </React.Fragment>
      )}
    </Caption>
  );
}

export function ContestHeader(props: ContestHeaderProps): JSX.Element {
  const { breadcrumbs, children, contest, district } = props;

  return (
    <Container id="contest-header">
      <ReadOnLoad>
        {/*
         * NOTE: This is visually rendered elsewhere in the screen footer, but
         * needs to be spoken on contest navigation for the benefit of
         * vision-impaired voters:
         */}
        {breadcrumbs && (
          <AudioOnly>
            <Breadcrumbs {...breadcrumbs} />
          </AudioOnly>
        )}
        <div>
          <Caption weight="semiBold">
            {electionStrings.districtName(district)}
          </Caption>
        </div>
        <div>
          <H2 as="h1">{electionStrings.contestTitle(contest)}</H2>
        </div>
        {children}
      </ReadOnLoad>
    </Container>
  );
}
