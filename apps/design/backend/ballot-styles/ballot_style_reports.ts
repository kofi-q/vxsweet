import { Buffer } from 'node:buffer';

import {
  BallotStyleReadinessReport,
  type BallotStyleReadinessReportProps,
} from '@vx/libs/ui/diagnostics';
import { renderToPdf } from '@vx/libs/printing/src';
import { type PlaywrightRenderer } from '@vx/libs/hmpb/src';

export interface BallotStyleReadinessReportParams {
  componentProps: BallotStyleReadinessReportProps;
  renderer: PlaywrightRenderer;
}

export async function renderBallotStyleReadinessReport(
  params: BallotStyleReadinessReportParams
): Promise<Buffer> {
  const { renderer, componentProps } = params;

  return (
    await renderToPdf(
      {
        document: BallotStyleReadinessReport(componentProps),
        usePrintTheme: true,
      },
      renderer.getBrowser()
    )
  ).unsafeUnwrap();
}
