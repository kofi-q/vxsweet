import test from '@playwright/test';
import { mockElectionPackageFileTree } from '@vx/libs/backend/election_package';
import { getMockFileUsbDriveHandler } from '@vx/libs/usb-drive/src';
import * as election from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot/election.json';
import { logInAsElectionManager, forceReset } from './helpers';

test.beforeEach(async ({ page }) => {
  await forceReset(page);
});

test('configure + scan', async ({ page }) => {
  const usbHandler = getMockFileUsbDriveHandler();
  await page
    .getByText(/Insert an election manager card to configure VxCentralScan/)
    .waitFor();
  const electionDefinition = election.toElectionDefinition();

  void logInAsElectionManager(page, electionDefinition.election);

  usbHandler.insert(
    await mockElectionPackageFileTree(election.toElectionPackage())
  );
  await page.getByText('No ballots have been scanned').waitFor();
  usbHandler.remove();

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByText('Toggle to Official Ballot Mode').click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Toggle to Official Ballot Mode' })
    .click();

  await page.getByText('No ballots have been scanned').waitFor();
  await page.getByText('Scan New Batch').click();
  await page
    .getByText('A total of 1 ballot has been scanned in 1 batch.')
    .waitFor();

  usbHandler.cleanup();
});
