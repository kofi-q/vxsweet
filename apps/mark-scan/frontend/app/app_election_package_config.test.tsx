import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { mockUsbDriveStatus } from '@vx/libs/ui/test-utils/mock_usb_drive';
import { type ApiMock, createApiMock } from '../test/helpers/mock_api_client';
import { render, screen } from '../test/react_testing_library';
import { App } from './app';
const electionGeneralDefinition = electionGeneral.toElectionDefinition();

let apiMock: ApiMock;

beforeEach(() => {
  jest.useFakeTimers();
  window.location.href = '/';
  apiMock = createApiMock();
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
});

test('renders an error if election package config endpoint returns an error', async () => {
  apiMock.expectGetMachineConfig({
    screenOrientation: 'portrait',
  });
  apiMock.expectGetSystemSettings();
  apiMock.expectGetElectionRecord(null);
  apiMock.expectGetElectionState();
  apiMock.setAuthStatusElectionManagerLoggedIn(electionGeneralDefinition);

  render(<App apiClient={apiMock.mockApiClient} />);

  apiMock.expectConfigureElectionPackageFromUsbError('election_key_mismatch');
  apiMock.expectGetSystemSettings();
  apiMock.expectGetElectionRecord(null);
  apiMock.expectGetElectionState();
  apiMock.setUsbDriveStatus(mockUsbDriveStatus('mounted'));
  await screen.findByText('Configuring VxMark from USB drive…');
  await screen.findByText(
    'The most recent election package found is for a different election.'
  );
});
