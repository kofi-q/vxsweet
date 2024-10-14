import type { BallotCountReportWarning } from '@vx/apps/admin/backend/src';
import { throwIllegalValue } from '@vx/libs/basics/src';

interface BallotCountReportWarningProps {
  ballotCountReportWarning: BallotCountReportWarning;
}

export function getBallotCountReportWarningText({
  ballotCountReportWarning,
}: BallotCountReportWarningProps): string {
  switch (ballotCountReportWarning.type) {
    case 'no-reports-match-filter':
      return `The current report parameters do not match any ballots.`;
    case 'content-too-large':
      return `This report is too large to be exported as a PDF. You may export the report as a CSV instead.`;
    /* istanbul ignore next */
    default:
      throwIllegalValue(ballotCountReportWarning);
  }
}
