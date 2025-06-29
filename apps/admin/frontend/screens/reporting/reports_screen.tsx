import { useContext } from 'react';

import { format, isElectionManagerAuth } from '@vx/libs/utils/src';
import { LinkButton } from '@vx/libs/ui/buttons';
import { H2, P, Font, H3, Icons } from '@vx/libs/ui/primitives';

import { assert } from '@vx/libs/basics/assert';
import styled from 'styled-components';
import { AppContext } from '../../contexts/app_context';

import { NavigationScreen } from '../../components/navigation_screen';
import { routerPaths } from '../../paths/router_paths';
import { getTotalBallotCount, getCastVoteRecordFileMode } from '../../api/api';
import { MarkResultsOfficialButton } from '../../components/mark_official_button';
import { OfficialResultsCard } from '../../components/official_results_card';

const Section = styled.section`
  margin-bottom: 2rem;
`;

export function ReportsScreen(): JSX.Element {
  const { electionDefinition, isOfficialResults, configuredAt, auth } =
    useContext(AppContext);
  assert(isElectionManagerAuth(auth));
  assert(electionDefinition && typeof configuredAt === 'string');

  const totalBallotCountQuery = getTotalBallotCount.useQuery();
  const castVoteRecordFileModeQuery = getCastVoteRecordFileMode.useQuery();
  const statusPrefix = isOfficialResults ? 'Official' : 'Unofficial';

  const fileMode = castVoteRecordFileModeQuery.data;

  const electionHasWriteInContest = electionDefinition.election.contests.some(
    (c) => c.type === 'candidate' && c.allowWriteIns
  );

  const totalBallotCount = totalBallotCountQuery.data ?? 0;
  const ballotCountSummaryText = totalBallotCountQuery.isSuccess ? (
    <P>
      <Font weight="bold">
        {fileMode === 'test' ? 'Test ' : ''}
        Ballot Count:
      </Font>{' '}
      {format.count(totalBallotCount)}
    </P>
  ) : (
    <P>Loading total ballot count...</P>
  );

  return (
    <NavigationScreen title="Election Reports">
      {ballotCountSummaryText}
      <OfficialResultsCard>
        {isOfficialResults ? (
          <H3>
            <Icons.Done color="success" />
            Election Results are Official
          </H3>
        ) : (
          <H3>
            <Icons.Info />
            Election Results are Unofficial
          </H3>
        )}
        <MarkResultsOfficialButton />
      </OfficialResultsCard>
      <Section>
        <H2>{statusPrefix} Tally Reports</H2>
        <P>
          <LinkButton variant="primary" to={routerPaths.tallyFullReport}>
            Full Election Tally Report
          </LinkButton>{' '}
          <LinkButton to={routerPaths.tallyAllPrecinctsReport}>
            All Precincts Tally Report
          </LinkButton>{' '}
          <LinkButton to={routerPaths.tallySinglePrecinctReport}>
            Single Precinct Tally Report
          </LinkButton>
        </P>
        <P>
          <LinkButton to={routerPaths.tallyReportBuilder}>
            Tally Report Builder
          </LinkButton>
        </P>
      </Section>

      <Section>
        <H2>{statusPrefix} Ballot Count Reports</H2>
        <P>
          <LinkButton to={routerPaths.ballotCountReportPrecinct}>
            Precinct Ballot Count Report
          </LinkButton>{' '}
          <LinkButton to={routerPaths.ballotCountReportVotingMethod}>
            Voting Method Ballot Count Report
          </LinkButton>
        </P>
        <P>
          <LinkButton to={routerPaths.ballotCountReportBuilder}>
            Ballot Count Report Builder
          </LinkButton>
        </P>
      </Section>
      {electionHasWriteInContest && (
        <Section>
          <H2>Other Reports</H2>
          <P>
            <LinkButton to={routerPaths.tallyWriteInReport}>
              {statusPrefix} Write-In Adjudication Report
            </LinkButton>
          </P>
        </Section>
      )}
    </NavigationScreen>
  );
}
