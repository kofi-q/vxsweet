import { assert } from '@vx/libs/basics/assert';
import { type DiagnosticRecord } from '@vx/libs/types/src';
import { H2, P } from '../primitives/typography';
import { InfoIcon, SuccessIcon, WarningIcon } from './icons';

export interface ScanAudioSectionProps {
  audioSectionContents?: React.ReactNode;
  mostRecentAudioDiagnostic?: DiagnosticRecord;
}

export function ScanAudioSection(props: ScanAudioSectionProps): JSX.Element {
  const { audioSectionContents, mostRecentAudioDiagnostic } = props;

  if (mostRecentAudioDiagnostic) {
    assert(mostRecentAudioDiagnostic.type === 'scan-audio');
  }

  return (
    <section>
      <H2>Speaker</H2>
      {!mostRecentAudioDiagnostic ? (
        <P>
          <InfoIcon /> No sound test on record
        </P>
      ) : mostRecentAudioDiagnostic.outcome === 'fail' ? (
        <P>
          <WarningIcon /> Sound test failed,{' '}
          {new Date(mostRecentAudioDiagnostic.timestamp).toLocaleString()}{' '}
          {mostRecentAudioDiagnostic.message
            ? ` — ${mostRecentAudioDiagnostic.message}`
            : ''}
        </P>
      ) : (
        <P>
          <SuccessIcon /> Sound test successful,{' '}
          {new Date(mostRecentAudioDiagnostic.timestamp).toLocaleString()}
        </P>
      )}
      {audioSectionContents}
    </section>
  );
}
