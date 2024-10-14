import { useContext } from 'react';
import { assert } from '@vx/libs/basics/src';
import { isElectionManagerAuth } from '@vx/libs/utils/src';
import { AppContext } from '../../contexts/app_context';
import { NavigationScreen } from '../../components/navigation_screen';
import { BallotCountReportViewer } from '../../components/reporting/ballot_count_report_viewer';
import {
  reportParentRoutes,
  ReportScreenContainer,
} from '../../components/reporting/shared';

export const TITLE = 'Voting Method Ballot Count Report';

export function VotingMethodBallotCountReport(): JSX.Element {
  const { electionDefinition, auth } = useContext(AppContext);
  assert(electionDefinition);
  assert(isElectionManagerAuth(auth));

  return (
    <NavigationScreen title={TITLE} parentRoutes={reportParentRoutes} noPadding>
      <ReportScreenContainer>
        <BallotCountReportViewer
          filter={{}}
          groupBy={{
            groupByVotingMethod: true,
            groupByParty: electionDefinition.election.type === 'primary',
          }}
          includeSheetCounts={false}
          disabled={false}
          autoGenerateReport
        />
      </ReportScreenContainer>
    </NavigationScreen>
  );
}
