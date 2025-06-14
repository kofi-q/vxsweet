import { Admin } from '@vx/libs/types/admin';
import { Tabulation } from '@vx/libs/types/tabulation';
import { type ElectionDefinition } from '@vx/libs/types/elections';

import {
  getDistrictById,
  getPartyById,
  getPrecinctById,
} from '@vx/libs/utils/src/tabulation';

import pluralize from 'pluralize';
import styled from 'styled-components';
import { Font } from '../primitives/typography';
import {
  getBatchLabel,
  getScannerLabel,
  type LabeledScannerBatch,
} from './utils';
import { Box } from './layout';

interface Props {
  electionDefinition: ElectionDefinition;
  scannerBatches: LabeledScannerBatch[];
  filter: Admin.FrontendReportingFilter;
}

const FilterContainer = styled(Box)`
  margin-bottom: 0.5em;
`;

const FilterDisplayRow = styled.p`
  margin: 0;

  &:last-child {
    margin-bottom: 0;
  }
`;

export function CustomFilterSummary({
  electionDefinition,
  scannerBatches,
  filter,
}: Props): JSX.Element {
  return (
    <FilterContainer data-testid="custom-filter-summary">
      {filter.votingMethods && (
        <FilterDisplayRow>
          <Font weight="semiBold">
            {pluralize('Voting Method', filter.votingMethods.length)}:
          </Font>{' '}
          {filter.votingMethods
            .map(
              (votingMethod) => Tabulation.VOTING_METHOD_LABELS[votingMethod]
            )
            .join(', ')}
        </FilterDisplayRow>
      )}
      {filter.precinctIds && (
        <FilterDisplayRow>
          <Font weight="semiBold">
            {pluralize('Precinct', filter.precinctIds.length)}:
          </Font>{' '}
          {filter.precinctIds
            .map(
              (precinctId) =>
                getPrecinctById(electionDefinition, precinctId).name
            )
            .join(', ')}
        </FilterDisplayRow>
      )}
      {filter.ballotStyleGroupIds && (
        <FilterDisplayRow>
          <Font weight="semiBold">
            {pluralize('Ballot Style', filter.ballotStyleGroupIds.length)}:
          </Font>{' '}
          {filter.ballotStyleGroupIds.join(', ')}
        </FilterDisplayRow>
      )}
      {filter.scannerIds && (
        <FilterDisplayRow>
          <Font weight="semiBold">
            {pluralize('Scanner', filter.scannerIds.length)}:
          </Font>{' '}
          {filter.scannerIds.map(getScannerLabel).join(', ')}
        </FilterDisplayRow>
      )}
      {filter.batchIds && (
        <FilterDisplayRow>
          <Font weight="semiBold">
            {pluralize('Batch', filter.batchIds.length)}:
          </Font>{' '}
          {filter.batchIds
            .map((batchId) => getBatchLabel(batchId, scannerBatches))
            .join(', ')}
        </FilterDisplayRow>
      )}
      {filter.adjudicationFlags && (
        <FilterDisplayRow>
          <Font weight="semiBold">
            {pluralize('Adjudication Status', filter.adjudicationFlags.length)}:
          </Font>{' '}
          {filter.adjudicationFlags
            .map((flag) => Admin.ADJUDICATION_FLAG_LABELS[flag])
            .join(', ')}
        </FilterDisplayRow>
      )}
      {filter.districtIds && (
        <FilterDisplayRow>
          <Font weight="semiBold">
            {pluralize('District', filter.districtIds.length)}:
          </Font>{' '}
          {filter.districtIds
            .map(
              (districtId) =>
                getDistrictById(electionDefinition, districtId).name
            )
            .join(', ')}
        </FilterDisplayRow>
      )}
      {filter.partyIds && (
        <FilterDisplayRow>
          <Font weight="semiBold">
            {pluralize('Party', filter.partyIds.length)}:
          </Font>{' '}
          {filter.partyIds
            .map(
              (partyId) => getPartyById(electionDefinition, partyId).fullName
            )
            .join(', ')}
        </FilterDisplayRow>
      )}
    </FilterContainer>
  );
}
