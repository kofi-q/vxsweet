import {
  type BallotStyleGroup,
  type Election,
  type ElectionDefinition,
  type MarkThresholds,
  formatElectionHashes,
  getPrecinctById,
  type PrecinctSelection,
} from '@vx/libs/types/elections';
import { LanguageCode } from '@vx/libs/types/languages';
import { assert, assertDefined } from '@vx/libs/basics/assert';
import { iter } from '@vx/libs/basics/iterators';
import { format, getGroupedBallotStyles } from '@vx/libs/utils/src';
import styled from 'styled-components';
import { H2, P } from '../primitives/typography';
import { InfoIcon, SuccessIcon, WarningIcon } from './icons';
import { Table } from '../src/table';

const BallotStyleTable = styled(Table)`
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
`;

export interface ConfigurationSectionProps {
  electionDefinition?: ElectionDefinition;
  electionPackageHash?: string;
  expectPrecinctSelection?: boolean;
  markThresholds?: MarkThresholds;
  precinctSelection?: PrecinctSelection;
}

function getPrecinctSelectionName(
  precinctSelection: PrecinctSelection,
  election: Election
): string {
  if (precinctSelection.kind === 'AllPrecincts') {
    return 'All Precincts';
  }

  const { precinctId } = precinctSelection;
  const precinct = getPrecinctById({ election, precinctId });
  assert(precinct);
  return precinct.name;
}

function getBallotStyleGroupForPrecinct(
  election: Election,
  precinctSelection?: PrecinctSelection
): BallotStyleGroup[] {
  if (!precinctSelection || precinctSelection.kind === 'AllPrecincts') {
    return getGroupedBallotStyles(election.ballotStyles);
  }

  const { precinctId } = precinctSelection;
  return getGroupedBallotStyles(
    election.ballotStyles.filter((bs) => bs.precincts.includes(precinctId))
  );
}

function truncate(num: number, decimals: number): number {
  return Math.trunc(num * 10 ** decimals) / 10 ** decimals;
}

export interface BallotStylesDetailSectionProps {
  election: Election;
  precinctSelection?: PrecinctSelection;
}

function BallotStylesDetailSection({
  election,
  precinctSelection,
}: BallotStylesDetailSectionProps): JSX.Element {
  const ballotStyleGroups = getBallotStyleGroupForPrecinct(
    election,
    precinctSelection
  );
  const isSingleLanguage = ballotStyleGroups.every(
    (bs) => bs.ballotStyles.length === 1
  );
  if (isSingleLanguage) {
    return <span>{election.ballotStyles.map((bs) => bs.id).join(', ')}</span>;
  }

  return (
    <BallotStyleTable>
      <thead>
        <tr>
          <th>ID</th>
          <th>Languages</th>
        </tr>
      </thead>
      <tbody>
        {ballotStyleGroups.map((group) => {
          const ballotStylesInGroup = group.ballotStyles;
          const languages = iter(ballotStylesInGroup)
            .flatMap(
              (bs) =>
                /* istanbul ignore next - unexpected condition */
                bs.languages || []
            )
            .map((code) =>
              format.languageDisplayName({
                languageCode: code,
                displayLanguageCode: LanguageCode.ENGLISH,
              })
            )
            .join(', ');
          return (
            <tr key={group.id}>
              <td>{group.id}</td>
              <td>{languages}</td>
            </tr>
          );
        })}
      </tbody>
    </BallotStyleTable>
  );
}

export function ConfigurationSection({
  electionDefinition,
  electionPackageHash,
  expectPrecinctSelection,
  markThresholds,
  precinctSelection,
}: ConfigurationSectionProps): JSX.Element {
  if (!electionDefinition) {
    return (
      <section>
        <H2>Configuration</H2>
        <P>
          <InfoIcon /> No election loaded on device
        </P>
      </section>
    );
  }
  const { election } = electionDefinition;

  return (
    <section>
      <H2>Configuration</H2>
      <P>
        <SuccessIcon /> Election: {election.title},{' '}
        {formatElectionHashes(
          electionDefinition.ballotHash,
          assertDefined(electionPackageHash)
        )}
      </P>
      {expectPrecinctSelection &&
        (precinctSelection ? (
          <P>
            <SuccessIcon /> Precinct:{' '}
            {getPrecinctSelectionName(precinctSelection, election)}
          </P>
        ) : (
          <P>
            <WarningIcon /> No precinct selected.
          </P>
        ))}
      {!(expectPrecinctSelection && !precinctSelection) && (
        <section>
          <SuccessIcon /> Ballot Styles:{' '}
          <BallotStylesDetailSection
            election={election}
            precinctSelection={precinctSelection}
          />
        </section>
      )}
      {markThresholds?.definite && (
        <P>
          <SuccessIcon /> Mark Threshold: {truncate(markThresholds.definite, 4)}
        </P>
      )}
      {markThresholds?.writeInTextArea && (
        <P>
          <SuccessIcon /> Write-in Threshold:{' '}
          {truncate(markThresholds.writeInTextArea, 4)}
        </P>
      )}
    </section>
  );
}
