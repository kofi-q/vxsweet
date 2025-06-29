import { expect, test } from '@playwright/test';
import { getMockFileUsbDriveHandler } from '@vx/libs/usb-drive/src';
import {
  HP_LASER_PRINTER_CONFIG,
  getMockFilePrinterHandler,
} from '@vx/libs/printing/src/printer';
import {
  SCANNER_RESULTS_FOLDER,
  generateElectionBasedSubfolderName,
} from '@vx/libs/utils/src';
import * as electionTwoPartyPrimaryFixtures from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary';
import * as electionTwoPartyPrimary from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary/election.json';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertDefined } from '@vx/libs/basics/assert';
import { zipFile } from '@vx/libs/test-utils/src';
import { ElectionPackageFileName } from '@vx/libs/types/elections';
import {
  forceLogOutAndResetElectionDefinition,
  logInAsElectionManager,
  logInAsSystemAdministrator,
  logOut,
} from './support/auth';
import { PAGE_SCROLL_DELTA_Y } from './support/pdf';

test.beforeEach(async ({ page }) => {
  await forceLogOutAndResetElectionDefinition(page);
  getMockFilePrinterHandler().cleanup();
  getMockFileUsbDriveHandler().cleanup();
});

test('viewing and exporting reports', async ({ page }) => {
  const usbHandler = getMockFileUsbDriveHandler();
  const printerHandler = getMockFilePrinterHandler();
  const electionDefinition = electionTwoPartyPrimary.toElectionDefinition();
  const { election, ballotHash, electionData } = electionDefinition;
  const electionPackage = await zipFile({
    [ElectionPackageFileName.ELECTION]: electionData,
  });
  const electionPackageFileName = 'election-package.zip';

  await page.goto('/');

  // load election definition as system administrator
  await logInAsSystemAdministrator(page);
  usbHandler.insert({
    [electionPackageFileName]: electionPackage,
  });

  await page.getByText(electionPackageFileName).click();
  await expect(
    page.getByRole('heading', { name: election.title })
  ).toBeVisible();
  await logOut(page);

  await logInAsElectionManager(page, election);
  await page.getByText('Tally').click();
  await expect(page.getByText('Cast Vote Records (CVRs)')).toBeVisible();

  const electionDirectory = generateElectionBasedSubfolderName(
    election,
    ballotHash
  );
  const testReportDirectoryName =
    'TEST__machine_VX-00-000__2023-08-16_17-02-24';
  const testReportDirectoryPath =
    electionTwoPartyPrimaryFixtures.castVoteRecordExport.asDirectoryPath();
  usbHandler.insert({
    [electionDirectory]: {
      [SCANNER_RESULTS_FOLDER]: {
        [testReportDirectoryName]: testReportDirectoryPath,
      },
    },
  });
  await page.getByText('Eject USB').waitFor();

  await page.getByRole('button', { name: 'Load CVRs' }).click();
  await expect(page.getByText('112')).toBeVisible();
  await expect(page.getByText('VX-00-000')).toBeVisible();
  await page.getByRole('button', { name: 'Load' }).click();
  await page.getByText('112 New CVRs Loaded').waitFor();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByText('Total CVR Count: 112').waitFor();

  await page.getByRole('button', { name: 'Reports' }).click();
  await expect(page.getByText('Unofficial Tally Reports')).toBeVisible();
  await page.getByText('Full Election Tally Report').click();

  // Check pagination
  await page.getByText('Page: 1/3').waitFor();
  await page.getByTestId('pdf-scroller').click();
  await page.mouse.wheel(0, PAGE_SCROLL_DELTA_Y);
  await page.getByText('Page: 2/3').waitFor();
  await page.mouse.wheel(0, PAGE_SCROLL_DELTA_Y);
  await page.getByText('Page: 3/3').waitFor();

  // Check Print
  await page.getByRole('button', { name: 'Print Report' }).click();
  await page.getByText('Please connect the printer.').waitFor();
  printerHandler.connectPrinter(HP_LASER_PRINTER_CONFIG);
  await page.getByText('You may continue printing.').waitFor();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Printing').waitFor();
  await expect(page.getByText('Printing')).toHaveCount(0);

  const printPath = printerHandler.getLastPrintPath();
  assert(printPath !== undefined);

  // Check PDF Export
  await page.getByRole('button', { name: 'Export Report PDF' }).click();
  await page.getByText('Save Tally Report').waitFor();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Tally Report Saved').waitFor();
  await page.getByRole('button', { name: 'Close' }).click();

  const exportedReportDirectory = join(
    assertDefined(usbHandler.getDataPath()),
    electionDirectory,
    'reports'
  );

  // Check CSV Export
  await page.getByRole('button', { name: 'Export Report CSV' }).click();
  await page.getByText('Save Tally Report').waitFor();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Tally Report Saved').waitFor();
  await page.getByRole('button', { name: 'Close' }).click();

  const exportedCsvFilename = readdirSync(exportedReportDirectory).filter(
    (file) => file.endsWith('.csv')
  )[0];
  expect(
    readFileSync(join(exportedReportDirectory, exportedCsvFilename))
  ).toMatchSnapshot({ name: 'full-election-tally-report.csv' });

  // Mark Official
  await page.getByRole('button', { name: 'Reports' }).click();
  await page
    .getByRole('button', { name: 'Mark Election Results as Official' })
    .click();
  await page
    .getByRole('alertdialog')
    .locator(
      page.getByRole('button', { name: 'Mark Election Results as Official' })
    )
    .click();

  // Check Official
  await expect(
    page.getByRole('button', { name: 'Mark Election Results as Official' })
  ).toBeDisabled();
  await expect(page.getByText('Official Tally Reports')).toBeVisible();

  // Check report shows official
  await page.getByText('Full Election Tally Report').click();
  await page.getByRole('button', { name: 'Print Report' }).click();
  await page.getByText('Printing').waitFor();
  await expect(page.getByText('Printing')).toHaveCount(0);

  const printPathOfficial = printerHandler.getLastPrintPath();
  assert(printPathOfficial !== undefined);

  await page.getByText('Tally', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Load CVRs' })).toBeDisabled();
});
