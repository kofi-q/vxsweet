import {
  DEFAULT_SYSTEM_SETTINGS,
  type ElectionDefinition,
} from '@vx/libs/types/elections';
import { type VxScreen } from '@vx/libs/ui/themes';
import { mockUsbDriveStatus } from '@vx/libs/ui/test-utils/mock_usb_drive';
import { type ApiMock } from './mock_api_client';

/**
 * Simulates inserting a USB drive, configuring the backend with an election definition,
 * and removing the USB drive.
 * @param apiMock
 * @param kiosk
 * @param screen
 * @param electionDefinition The election definition to return from apiMock.
 */
export async function configureFromUsbThenRemove(
  apiMock: ApiMock,
  screen: VxScreen,
  electionDefinition: ElectionDefinition
): Promise<void> {
  // Insert USB
  apiMock.expectConfigureElectionPackageFromUsb(electionDefinition);
  apiMock.expectGetSystemSettings(DEFAULT_SYSTEM_SETTINGS);
  apiMock.expectGetElectionRecord(electionDefinition);
  apiMock.setUsbDriveStatus(mockUsbDriveStatus('mounted'));
  apiMock.expectGetElectionState();

  // Remove USB after configuration is done
  await screen.findByText('Election Definition is loaded.');
  apiMock.setUsbDriveStatus(mockUsbDriveStatus('no_drive'));
}
