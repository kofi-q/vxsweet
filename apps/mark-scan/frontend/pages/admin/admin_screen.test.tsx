import * as electionTwoPartyPrimaryFixtures from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary';
import { ALL_PRECINCTS_SELECTION } from '@vx/libs/utils/src';
import userEvent from '@testing-library/user-event';
import { mockUsbDriveStatus } from '@vx/libs/ui/test-utils/mock_usb_drive';
import { formatElectionHashes } from '@vx/libs/types/elections';
import { act, screen, within } from '../../test/react_testing_library';
import { render } from '../../test/test_utils';
import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';

import { advanceTimers } from '../../test/helpers/timers';

import { AdminScreen, type AdminScreenProps } from './admin_screen';
import { mockMachineConfig } from '../../test/helpers/mock_machine_config';
import {
  type ApiMock,
  createApiMock,
  provideApi,
} from '../../test/helpers/mock_api_client';
const election = electionGeneral.election;
const electionDefinition = electionGeneral.toElectionDefinition();

let apiMock: ApiMock;

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2020-10-31T00:00:00.000'));
  window.location.href = '/';
  apiMock = createApiMock();
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
});

function renderScreen(props: Partial<AdminScreenProps> = {}) {
  return render(
    provideApi(
      apiMock,
      <AdminScreen
        ballotsPrintedCount={0}
        electionDefinition={electionDefinition}
        electionPackageHash="test-election-package-hash"
        isTestMode
        unconfigure={jest.fn()}
        machineConfig={mockMachineConfig({
          codeVersion: 'test', // Override default
        })}
        pollsState="polls_open"
        usbDriveStatus={mockUsbDriveStatus('mounted')}
        {...props}
      />
    )
  );
}

test('renders date and time settings modal', async () => {
  renderScreen();

  advanceTimers();

  // We just do a simple happy path test here, since the libs/ui/set_clock unit
  // tests cover full behavior
  const startDate = 'Sat, Oct 31, 2020, 12:00 AM AKDT';
  await screen.findByText(startDate);

  // Open Modal and change date
  userEvent.click(screen.getButton('Set Date and Time'));

  within(screen.getByTestId('modal')).getByText(startDate);

  const selectYear = screen.getByTestId('selectYear');
  const optionYear =
    within(selectYear).getByText<HTMLOptionElement>('2025').value;
  userEvent.selectOptions(selectYear, optionYear);

  // Save Date and Timezone
  apiMock.mockApiClient.setClock
    .expectCallWith({
      isoDatetime: '2025-10-31T00:00:00.000-08:00',
      ianaZone: 'America/Anchorage',
    })
    .resolves();
  apiMock.expectLogOut();
  // eslint-disable-next-line @typescript-eslint/require-await
  await act(async () => {
    userEvent.click(within(screen.getByTestId('modal')).getByText('Save'));
  });

  // Date is reset to system time after save to kiosk-browser
  screen.getByText(startDate);
});

test('can switch the precinct', async () => {
  renderScreen();

  apiMock.expectSetPrecinctSelection(ALL_PRECINCTS_SELECTION);
  userEvent.click(await screen.findByText('Select a precinct…'));
  userEvent.click(await screen.findByText('All Precincts'));
});

test('precinct change disabled if polls closed', async () => {
  renderScreen({ pollsState: 'polls_closed_final' });

  const precinctSelect = await screen.findByLabelText('Select a precinct…');
  expect(precinctSelect).toBeDisabled();
});

test('precinct selection disabled if single precinct election', async () => {
  renderScreen({
    electionDefinition:
      electionTwoPartyPrimaryFixtures.asSinglePrecinctElectionDefinition(),
  });

  await screen.findByRole('heading', { name: 'Election Manager Settings' });
  expect(screen.getByLabelText('Select a precinct…')).toBeDisabled();
  screen.getByText(
    'Precinct cannot be changed because there is only one precinct configured for this election.'
  );
});

test('renders a save logs button with no usb ', async () => {
  renderScreen({ usbDriveStatus: mockUsbDriveStatus('no_drive') });
  const saveLogsButton = await screen.findByText('Save Log File');
  userEvent.click(saveLogsButton);
  await screen.findByText('No USB Drive Detected');
});

test('renders a save logs button with usb mounted', async () => {
  renderScreen({ usbDriveStatus: mockUsbDriveStatus('mounted') });
  const saveLogsButton = await screen.findByText('Save Log File');
  userEvent.click(saveLogsButton);
  await screen.findByText('Select a log format:');
});

test('renders a USB controller button', async () => {
  renderScreen({ usbDriveStatus: mockUsbDriveStatus('no_drive') });
  await screen.findByText('No USB');

  renderScreen({ usbDriveStatus: mockUsbDriveStatus('mounted') });
  await screen.findByText('Eject USB');
});

test('USB button calls eject', async () => {
  renderScreen({ usbDriveStatus: mockUsbDriveStatus('mounted') });
  const ejectButton = await screen.findByText('Eject USB');
  apiMock.expectEjectUsbDrive();
  userEvent.click(ejectButton);
});

test('Unconfigure will eject usb', async () => {
  renderScreen({
    usbDriveStatus: mockUsbDriveStatus('mounted'),
  });
  const unconfigureButton = await screen.findByText('Unconfigure Machine');
  apiMock.expectEjectUsbDrive();
  userEvent.click(unconfigureButton);
  userEvent.click(screen.getButton('Delete All Election Data'));
});

test('Shows election info', () => {
  renderScreen();
  screen.getByText(election.title);
  screen.getByText(
    formatElectionHashes(
      electionDefinition.ballotHash,
      'test-election-package-hash'
    )
  );
});

test('Shows diagnostics button and renders screen after click', async () => {
  renderScreen();
  apiMock.expectGetElectionRecord(null);
  apiMock.expectGetElectionState();
  apiMock.expectGetApplicationDiskSpaceSummary();
  apiMock.expectGetIsAccessibleControllerInputDetected();
  apiMock.expectGetMostRecentDiagnostic('mark-scan-accessible-controller');
  apiMock.expectGetMostRecentDiagnostic('mark-scan-paper-handler');
  apiMock.expectGetMostRecentDiagnostic('mark-scan-pat-input');
  apiMock.expectGetMostRecentDiagnostic('mark-scan-headphone-input');
  apiMock.expectGetMarkScanBmdModel();

  const diagnosticsButton = await screen.findByText('Diagnostics');
  userEvent.click(diagnosticsButton);
  await screen.findByRole('heading', { name: 'System Diagnostics' });
  userEvent.click(screen.getByText('Back'));
  await screen.findByRole('heading', { name: 'Election Manager Settings' });
});
