import { Buffer } from 'node:buffer';

import {
  BallotStyleReadinessReport,
  BallotStyleReadinessReportProps,
} from '@vx/libs/ui/src';
import { renderToPdf } from '@vx/libs/printing/src';
import { PlaywrightRenderer } from '@vx/libs/hmpb/src';

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
