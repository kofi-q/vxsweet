import { readElection } from '@vx/libs/fs/src';
import { AdminTallyReportByParty } from '@vx/libs/ui/reports';
import { buildSimpleMockTallyReportResults } from '@vx/libs/utils/src/tabulation';
import { renderToPdf } from '../src/render';

export async function main(args: readonly string[]): Promise<void> {
  if (args.length !== 2) {
    console.error('Usage: render-tally-report election.json output-path.pdf');
    process.exit(1);
  }

  const electionPath = args[0];
  const outputPath = args[1];
  const electionDefinition = (await readElection(electionPath)).unsafeUnwrap();
  const { election } = electionDefinition;

  (
    await renderToPdf({
      document: (
        <AdminTallyReportByParty
          electionDefinition={electionDefinition}
          electionPackageHash="00000000000000000000"
          isTest={false}
          isOfficial={false}
          isForLogicAndAccuracyTesting={false}
          includeSignatureLines={false}
          generatedAtTime={new Date()}
          testId="render-tally-report"
          tallyReportResults={buildSimpleMockTallyReportResults({
            election,
            scannedBallotCount: 0,
          })}
        />
      ),
      outputPath,
    })
  ).unsafeUnwrap();
}
