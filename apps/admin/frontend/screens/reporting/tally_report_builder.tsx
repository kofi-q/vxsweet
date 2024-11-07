import { P } from '@vx/libs/ui/primitives';
import { useContext, useState } from 'react';
import { assert } from '@vx/libs/basics/assert';
import { isElectionManagerAuth } from '@vx/libs/utils/src';
import { isFilterEmpty, isGroupByEmpty } from '@vx/libs/utils/src/tabulation';
import { Admin, Tabulation } from '@vx/libs/types/src';
import { AppContext } from '../../contexts/app_context';
import { NavigationScreen } from '../../components/navigation_screen';
import { FilterEditor } from '../../components/reporting/filter_editor';
import { GroupByEditor } from '../../components/reporting/group_by_editor';
import { TallyReportViewer } from '../../components/reporting/tally_report_viewer';
import { canonicalizeFilter, canonicalizeGroupBy } from '../../utils/reporting';
import {
  ReportBuilderControls,
  ControlLabel,
  reportParentRoutes,
  ReportScreenContainer,
} from '../../components/reporting/shared';

const TITLE = 'Tally Report Builder';

export function TallyReportBuilder(): JSX.Element {
  const { electionDefinition, auth } = useContext(AppContext);
  assert(electionDefinition);
  assert(isElectionManagerAuth(auth));
  const { election } = electionDefinition;

  const [filter, setFilter] = useState<Admin.FrontendReportingFilter>({});
  const [groupBy, setGroupBy] = useState<Tabulation.GroupBy>({});

  function updateFilter(newFilter: Admin.FrontendReportingFilter) {
    setFilter(canonicalizeFilter(newFilter));
  }

  function updateGroupBy(newGroupBy: Tabulation.GroupBy) {
    setGroupBy(canonicalizeGroupBy(newGroupBy));
  }

  const hasMadeSelections = !isFilterEmpty(filter) || !isGroupByEmpty(groupBy);
  return (
    <NavigationScreen title={TITLE} parentRoutes={reportParentRoutes} noPadding>
      <ReportScreenContainer>
        <ReportBuilderControls>
          <div style={{ marginBottom: '1.5rem' }}>
            <ControlLabel>Filters</ControlLabel>
            <P>Restrict the report to ballots matching following criteria:</P>
            <FilterEditor
              election={election}
              onChange={updateFilter}
              allowedFilters={[
                'ballot-style',
                'batch',
                'precinct',
                'scanner',
                'voting-method',
                'district',
              ]} // omits party
            />
          </div>
          <div>
            <ControlLabel>Report By</ControlLabel>
            <P>Organize the results into multiple reports by the following:</P>
            <GroupByEditor
              groupBy={groupBy}
              setGroupBy={updateGroupBy}
              allowedOptions={[
                'groupByBallotStyle',
                'groupByBatch',
                'groupByPrecinct',
                'groupByScanner',
                'groupByVotingMethod',
              ]} // omits party
            />
          </div>
        </ReportBuilderControls>
        <TallyReportViewer
          filter={filter}
          groupBy={groupBy}
          disabled={!hasMadeSelections}
          autoGenerateReport={false}
        />
      </ReportScreenContainer>
    </NavigationScreen>
  );
}
