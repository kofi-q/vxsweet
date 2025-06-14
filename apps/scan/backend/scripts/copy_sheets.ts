import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuid } from 'uuid';
import { type AcceptedSheet } from '@vx/libs/backend/cast_vote_records';
import { assert, assertDefined } from '@vx/libs/basics/assert';
import { extractErrorMessage } from '@vx/libs/basics/errors';
import { iter } from '@vx/libs/basics/iterators';
import { safeParseInt } from '@vx/libs/types/basic';

import { BaseLogger } from '@vx/libs/logging/src';
import { LogSource } from '@vx/libs/logging/src/base_types';
import { SCAN_WORKSPACE } from '../globals/globals';
import { Store } from '../store/store';
import { createWorkspace } from '../workspace/workspace';

const usageMessage = `Usage: copy-sheets <target-sheet-count>

Arguments:
  <target-sheet-count>\tThe target total sheet count after copying`;

interface CopySheetsInput {
  targetSheetCount: number;
}

function checkEnvironment(): void {
  assert(process.env.NODE_ENV !== 'production', 'Cannot be run in production');
}

function parseCommandLineArgs(args: readonly string[]): CopySheetsInput {
  const parseTargetSheetCountResult = safeParseInt(args[0]);
  if (args.length !== 1 || !parseTargetSheetCountResult.isOk()) {
    console.error(usageMessage);
    process.exit(1);
  }
  const targetSheetCount = parseTargetSheetCountResult.ok();
  return { targetSheetCount };
}

function copySheet(store: Store, sheet: AcceptedSheet): string {
  const newSheetId = uuid();
  const newSheet: AcceptedSheet = {
    ...sheet,
    id: newSheetId,
    frontImagePath: path.join(
      path.dirname(sheet.frontImagePath),
      `${newSheetId}-front.jpg`
    ),
    backImagePath: path.join(
      path.dirname(sheet.backImagePath),
      `${newSheetId}-back.jpg`
    ),
  };

  fs.copyFileSync(sheet.frontImagePath, newSheet.frontImagePath);
  fs.copyFileSync(sheet.backImagePath, newSheet.backImagePath);

  store.addSheet(newSheetId, newSheet.batchId, [
    {
      imagePath: newSheet.frontImagePath,
      interpretation: newSheet.interpretation[0],
    },
    {
      imagePath: newSheet.backImagePath,
      interpretation: newSheet.interpretation[1],
    },
  ]);
  return newSheetId;
}

function copySheets({ targetSheetCount }: CopySheetsInput): void {
  const { store } = createWorkspace(
    assertDefined(SCAN_WORKSPACE),
    new BaseLogger(LogSource.VxDevelopmentScript)
  );

  const currentSheetCount = store.getBallotsCounted();
  assert(
    currentSheetCount > 0,
    'Scanner store should contain at least one sheet to copy'
  );
  assert(
    targetSheetCount > currentSheetCount,
    `Target sheet count should be greater than current sheet count (${currentSheetCount})`
  );
  const numSheetsToCreate = targetSheetCount - currentSheetCount;

  const maxNumSheetsToReadForCopying = Math.min(
    numSheetsToCreate,
    500 // A cap to limit how much data the script loads
  );

  const sheets = iter(store.forEachAcceptedSheet())
    .take(maxNumSheetsToReadForCopying)
    .toArray();

  const newSheetIds: string[] = [];
  for (let i = 0; i < numSheetsToCreate; i += 1) {
    const sheet = sheets[i % sheets.length];
    const newSheetId = copySheet(store, sheet);
    newSheetIds.push(newSheetId);
  }

  const sheetOrSheets = numSheetsToCreate === 1 ? 'sheet' : 'sheets';
  console.log(
    `✅ Created ${numSheetsToCreate} new ${sheetOrSheets} by copying existing sheets, ` +
      `bringing total sheet count to ${targetSheetCount}`
  );

  // Ensure that we sync cast vote records to the now out-of-sync USB drive
  for (const newSheetId of newSheetIds) {
    store.addPendingContinuousExportOperation(newSheetId);
  }
  console.log(
    '🟡 Restart VxScan if already running ' +
      'to surface the prompt to sync cast vote records to the now out-of-sync USB drive'
  );
}

/**
 * A script for copying a scanner store's sheet records to facilitate scale testing
 */
export function main(args: readonly string[]): void {
  try {
    checkEnvironment();
    copySheets(parseCommandLineArgs(args));
  } catch (error) {
    console.error(`❌ ${extractErrorMessage(error)}`);
    process.exit(1);
  }
}
