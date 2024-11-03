import { formatFullDateTimeZone } from '@vx/libs/utils/src';
import { DateTime } from 'luxon';
import {
  type ElectionDefinition,
  formatBallotHash,
  formatElectionHashes,
} from '@vx/libs/types/src';
import { LabeledValue, ReportMetadata } from './report_header';

export function AdminReportMetadata({
  generatedAtTime,
  electionDefinition,
  electionPackageHash,
}: {
  generatedAtTime: Date;
  electionDefinition: ElectionDefinition;
  electionPackageHash?: string;
}): JSX.Element {
  return (
    <ReportMetadata>
      <LabeledValue
        label="Report Generated"
        value={formatFullDateTimeZone(DateTime.fromJSDate(generatedAtTime), {
          includeWeekday: false,
        })}
      />
      <LabeledValue
        label="Election ID"
        value={
          // Test deck tally reports (generated in VxDesign) don't yet have an
          // election package hash, so we just show the ballot hash. In all
          // other cases we show both.
          electionPackageHash
            ? formatElectionHashes(
                electionDefinition.ballotHash,
                electionPackageHash
              )
            : formatBallotHash(electionDefinition.ballotHash)
        }
      />
    </ReportMetadata>
  );
}
