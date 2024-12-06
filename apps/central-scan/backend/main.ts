import { BaseLogger, LogEventId } from '@vx/libs/logging/src';
import { LogSource } from '@vx/libs/logging/src/base_types';
import { iter } from '@vx/libs/basics/iterators';
import { handleUncaughtExceptions } from '@vx/libs/backend/exceptions';
import { loadEnvVarsFromDotenvFiles } from '@vx/libs/backend/env';
import { MOCK_SCANNER_FILES } from './globals/globals';
import { LoopScanner, parseBatchesFromEnv } from './scanners/loop/loop_scanner';
import { type BatchScanner } from './scanners/fujitsu/fujitsu_scanner';
import * as server from './server/server';

loadEnvVarsFromDotenvFiles();

const logger = new BaseLogger(LogSource.VxCentralScanService);

function getScanner(): BatchScanner | undefined {
  const mockScannerFiles = parseBatchesFromEnv(MOCK_SCANNER_FILES);
  if (!mockScannerFiles) return undefined;
  process.stdout.write(
    `Using mock scanner that scans ${iter(mockScannerFiles)
      .map((sheets) => sheets.length)
      .sum()} sheet(s) in ${mockScannerFiles.length} batch(es) repeatedly.\n`
  );
  return new LoopScanner(mockScannerFiles);
}

async function main(): Promise<number> {
  handleUncaughtExceptions(logger);

  await server.start({ batchScanner: getScanner(), logger });
  return 0;
}

void main()
  .catch((error) => {
    void logger.log(LogEventId.ApplicationStartup, 'system', {
      message: `Error in starting Scan Service: ${error.stack}`,
      disposition: 'failure',
    });
    return 1;
  })
  .then((code) => {
    process.exitCode = code;
  });
