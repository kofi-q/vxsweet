jest.mock('@vx/libs/utils/src', () => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag: BooleanEnvironmentVariableName) =>
      featureFlagMock.isEnabled(flag),
  };
});

import { render, screen, waitFor, within } from '@testing-library/react';
import { Buffer } from 'node:buffer';
import userEvent from '@testing-library/user-event';
import {
  createMockClient,
  type MockClient,
} from '@vx/libs/grout/test-utils/src';
import { type Api } from '../../backend/src/dev_dock_api';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import {
  mockSystemAdministratorUser,
  mockElectionManagerUser,
  mockPollWorkerUser,
  mockKiosk,
  mockFileWriter,
} from '@vx/libs/test-utils/src';
import { type CardStatus } from '@vx/libs/auth/cards';
import { DevDock } from './dev_dock';

const noCardStatus: CardStatus = {
  status: 'no_card',
};
const systemAdminCardStatus: CardStatus = {
  status: 'ready',
  cardDetails: {
    user: mockSystemAdministratorUser(),
  },
};
const electionManagerCardStatus: CardStatus = {
  status: 'ready',
  cardDetails: {
    user: mockElectionManagerUser(),
  },
};
const pollWorkerCardStatus: CardStatus = {
  status: 'ready',
  cardDetails: {
    user: mockPollWorkerUser(),
    hasPin: false,
  },
};

const featureFlagMock = getFeatureFlagMock();

let mockApiClient: MockClient<Api>;
let kiosk!: jest.Mocked<KioskBrowser.Kiosk>;

beforeEach(() => {
  mockApiClient = createMockClient<Api>();
  mockApiClient.getMachineType.expectCallWith().resolves('central-scan');
  mockApiClient.getCardStatus.expectCallWith().resolves(noCardStatus);
  mockApiClient.getUsbDriveStatus.expectCallWith().resolves('removed');
  mockApiClient.getCurrentFixtureElectionPaths.expectCallWith().resolves([
    {
      title: 'electionGeneral',
      path: 'libs/fixtures/data/electionGeneral/election.json',
    },
    {
      title: 'electionFamousNames2021',
      path: 'libs/fixtures/data/electionFamousNames2021/election.json',
    },
    {
      title: 'electionTwoPartyPrimary',
      path: 'libs/fixtures/data/electionTwoPartyPrimary/election.json',
    },
  ]);
  mockApiClient.getElection.expectCallWith().resolves({
    title: 'Sample General Election',
    path: 'libs/fixtures/data/electionGeneral/election.json',
  });
  featureFlagMock.enableFeatureFlag(
    BooleanEnvironmentVariableName.ENABLE_DEV_DOCK
  );
  featureFlagMock.enableFeatureFlag(
    BooleanEnvironmentVariableName.USE_MOCK_CARDS
  );
  featureFlagMock.enableFeatureFlag(
    BooleanEnvironmentVariableName.USE_MOCK_USB_DRIVE
  );
  kiosk = mockKiosk();
  window.kiosk = kiosk;
});

afterEach(() => {
  mockApiClient.assertComplete();
  featureFlagMock.resetFeatureFlags();
});

test('renders nothing if dev dock is disabled', () => {
  mockApiClient.getCardStatus.reset();
  mockApiClient.getElection.reset();
  mockApiClient.getUsbDriveStatus.reset();
  mockApiClient.getMachineType.reset();
  mockApiClient.getCurrentFixtureElectionPaths.reset();
  featureFlagMock.disableFeatureFlag(
    BooleanEnvironmentVariableName.ENABLE_DEV_DOCK
  );
  const { container } = render(<DevDock apiClient={mockApiClient} />);
  expect(container).toBeEmptyDOMElement();
});

test('card mock controls', async () => {
  render(<DevDock apiClient={mockApiClient} />);

  // Card controls should enable once status loads
  const systemAdminControl = await screen.findByRole('button', {
    name: 'System Admin',
  });
  await waitFor(() => {
    expect(systemAdminControl).toBeEnabled();
  });
  const electionManagerControl = screen.getByRole('button', {
    name: 'Election Manager',
  });
  const pollWorkerControl = screen.getByRole('button', {
    name: 'Poll Worker',
  });
  expect(electionManagerControl).toBeEnabled();
  expect(pollWorkerControl).toBeEnabled();

  // Insert system admin card
  mockApiClient.insertCard
    .expectCallWith({ role: 'system_administrator' })
    .resolves();
  mockApiClient.getCardStatus.expectCallWith().resolves(systemAdminCardStatus);
  userEvent.click(systemAdminControl);
  await waitFor(() => {
    expect(electionManagerControl).toBeDisabled();
    expect(pollWorkerControl).toBeDisabled();
  });

  // Remove system admin card
  mockApiClient.removeCard.expectCallWith().resolves();
  mockApiClient.getCardStatus.expectCallWith().resolves(noCardStatus);
  userEvent.click(systemAdminControl);
  await waitFor(() => {
    expect(electionManagerControl).toBeEnabled();
    expect(pollWorkerControl).toBeEnabled();
  });

  // Insert election manager card
  mockApiClient.insertCard
    .expectCallWith({ role: 'election_manager' })
    .resolves();
  mockApiClient.getCardStatus
    .expectCallWith()
    .resolves(electionManagerCardStatus);
  userEvent.click(electionManagerControl);
  await waitFor(() => {
    expect(systemAdminControl).toBeDisabled();
    expect(pollWorkerControl).toBeDisabled();
  });

  // Remove election manager card
  mockApiClient.removeCard.expectCallWith().resolves();
  mockApiClient.getCardStatus.expectCallWith().resolves(noCardStatus);
  userEvent.click(electionManagerControl);
  await waitFor(() => {
    expect(systemAdminControl).toBeEnabled();
    expect(pollWorkerControl).toBeEnabled();
  });

  // Insert poll worker card
  mockApiClient.insertCard.expectCallWith({ role: 'poll_worker' }).resolves();
  mockApiClient.getCardStatus.expectCallWith().resolves(pollWorkerCardStatus);
  userEvent.click(pollWorkerControl);
  await waitFor(() => {
    expect(systemAdminControl).toBeDisabled();
    expect(electionManagerControl).toBeDisabled();
  });

  // Remove poll worker card
  mockApiClient.removeCard.expectCallWith().resolves();
  mockApiClient.getCardStatus.expectCallWith().resolves(noCardStatus);
  userEvent.click(pollWorkerControl);
  await waitFor(() => {
    expect(systemAdminControl).toBeEnabled();
    expect(electionManagerControl).toBeEnabled();
  });
});

test('disabled card mock controls if card mocks are disabled', async () => {
  featureFlagMock.disableFeatureFlag(
    BooleanEnvironmentVariableName.USE_MOCK_CARDS
  );
  render(<DevDock apiClient={mockApiClient} />);

  await screen.findByText('Smart card mocks disabled');
  const systemAdminControl = screen.getByRole('button', {
    name: 'System Admin',
  });
  const electionManagerControl = screen.getByRole('button', {
    name: 'Election Manager',
  });
  const pollWorkerControl = screen.getByRole('button', {
    name: 'Poll Worker',
  });
  // Since the controls are disabled until the card status loads, we need to
  // wait for the API call to complete before checking that the controls are
  // still disabled.
  await waitFor(() => mockApiClient.assertComplete());
  expect(systemAdminControl).toBeDisabled();
  expect(electionManagerControl).toBeDisabled();
  expect(pollWorkerControl).toBeDisabled();
});

test('election selector', async () => {
  render(<DevDock apiClient={mockApiClient} />);
  const electionSelector = await screen.findByRole('combobox');
  await waitFor(() => {
    expect(electionSelector).toHaveValue(
      'libs/fixtures/data/electionGeneral/election.json'
    );
  });

  mockApiClient.setElection
    .expectCallWith({
      path: 'libs/fixtures/data/electionFamousNames2021/election.json',
    })
    .resolves();
  mockApiClient.getElection.expectCallWith().resolves({
    title: 'Famous Names',
    path: 'libs/fixtures/data/electionFamousNames2021/election.json',
  });
  userEvent.selectOptions(
    electionSelector,
    screen.getByRole('option', { name: /electionFamousNames2021/ })
  );
  await waitFor(() => {
    expect(electionSelector).toHaveValue(
      'libs/fixtures/data/electionFamousNames2021/election.json'
    );
  });
});

test('USB drive controls', async () => {
  render(<DevDock apiClient={mockApiClient} />);
  const usbDriveControl = await screen.findByRole('button', {
    name: 'USB Drive',
  });
  await waitFor(() => expect(usbDriveControl).toBeEnabled());

  mockApiClient.insertUsbDrive.expectCallWith().resolves();
  mockApiClient.getUsbDriveStatus.expectCallWith().resolves('inserted');
  userEvent.click(usbDriveControl);
  // Not easy to test the color change of the button, so we'll just wait for the
  // API call to complete.
  await waitFor(() => mockApiClient.assertComplete());

  mockApiClient.removeUsbDrive.expectCallWith().resolves();
  mockApiClient.getUsbDriveStatus.expectCallWith().resolves('removed');
  userEvent.click(usbDriveControl);
  await waitFor(() => mockApiClient.assertComplete());

  const clearUsbDriveButton = screen.getByRole('button', {
    name: 'Clear',
  });
  mockApiClient.clearUsbDrive.expectCallWith().resolves();
  mockApiClient.getUsbDriveStatus.expectCallWith().resolves('removed');
  userEvent.click(clearUsbDriveButton);
  await waitFor(() => mockApiClient.assertComplete());
});

test('disabled USB drive controls if USB drive mocks are disabled', async () => {
  featureFlagMock.disableFeatureFlag(
    BooleanEnvironmentVariableName.USE_MOCK_USB_DRIVE
  );
  render(<DevDock apiClient={mockApiClient} />);

  await screen.findByText('USB mock disabled');
  const usbDriveControl = screen.getByRole('button', {
    name: 'USB Drive',
  });
  const clearUsbDriveButton = screen.getByRole('button', {
    name: 'Clear',
  });
  // Since the controls are disabled until the USB drive status loads, we need to
  // wait for the API call to complete before checking that the controls are
  // still disabled.
  await waitFor(() => mockApiClient.assertComplete());
  expect(usbDriveControl).toBeDisabled();
  expect(clearUsbDriveButton).toBeDisabled();
});

test('screenshot button', async () => {
  render(<DevDock apiClient={mockApiClient} />);
  const screenshotButton = await screen.findByRole('button', {
    name: 'Capture Screenshot',
  });

  const screenshotBuffer = Buffer.of();
  const fileWriter = mockFileWriter();
  kiosk.captureScreenshot.mockResolvedValueOnce(screenshotBuffer);
  kiosk.saveAs.mockResolvedValueOnce(fileWriter);
  userEvent.click(screenshotButton);

  await waitFor(() => {
    expect(kiosk.captureScreenshot).toHaveBeenCalled();
    expect(kiosk.saveAs).toHaveBeenCalled();
    expect(fileWriter.write).toHaveBeenCalledWith(screenshotBuffer);
  });
});

test('printer mock control', async () => {
  featureFlagMock.enableFeatureFlag(
    BooleanEnvironmentVariableName.USE_MOCK_PRINTER
  );

  mockApiClient.getMachineType.reset();
  mockApiClient.getMachineType.expectCallWith().resolves('admin');
  mockApiClient.getPrinterStatus.expectCallWith().resolves({
    connected: false,
  });

  render(<DevDock apiClient={mockApiClient} />);
  const printerButton = await screen.findByRole('button', {
    name: 'Printer',
  });

  mockApiClient.connectPrinter.expectCallWith().resolves();
  mockApiClient.getPrinterStatus.expectCallWith().resolves({
    connected: true,
    config: {
      label: 'mock',
      vendorId: 0,
      productId: 0,
      baseDeviceUri: 'mock://',
      ppd: 'mock.ppd',
      supportsIpp: false,
    },
  });
  userEvent.click(printerButton);
  await waitFor(() => mockApiClient.assertComplete());

  mockApiClient.disconnectPrinter.expectCallWith().resolves();
  mockApiClient.getPrinterStatus.expectCallWith().resolves({
    connected: false,
  });
  userEvent.click(printerButton);
  await waitFor(() => mockApiClient.assertComplete());

  featureFlagMock.disableFeatureFlag(
    BooleanEnvironmentVariableName.USE_MOCK_PRINTER
  );
});

test('printer mock when disabled', async () => {
  featureFlagMock.disableFeatureFlag(
    BooleanEnvironmentVariableName.USE_MOCK_PRINTER
  );

  mockApiClient.getMachineType.reset();
  mockApiClient.getMachineType.expectCallWith().resolves('admin');
  mockApiClient.getPrinterStatus.expectCallWith().resolves({
    connected: false,
  });

  render(<DevDock apiClient={mockApiClient} />);
  const printerButton = await screen.findByRole('button', {
    name: 'Printer',
  });

  expect(printerButton).toBeDisabled();
  screen.getByText('Printer mock disabled');
  userEvent.click(printerButton);
});

describe('fujitsu printer mock', () => {
  test('when disabled', async () => {
    featureFlagMock.disableFeatureFlag(
      BooleanEnvironmentVariableName.USE_MOCK_PRINTER
    );

    mockApiClient.getMachineType.reset();
    mockApiClient.getMachineType.expectCallWith().resolves('scan');
    mockApiClient.getFujitsuPrinterStatus.expectCallWith().resolves({
      state: 'idle',
    });

    render(<DevDock apiClient={mockApiClient} />);
    const dropdown = await screen.findByLabelText('Thermal Printer:');

    expect(dropdown).toBeDisabled();
    within(dropdown).getByText('Disabled');
  });

  test('updating mock printer status', async () => {
    featureFlagMock.enableFeatureFlag(
      BooleanEnvironmentVariableName.USE_MOCK_PRINTER
    );

    mockApiClient.getMachineType.reset();
    mockApiClient.getMachineType.expectCallWith().resolves('scan');
    mockApiClient.getFujitsuPrinterStatus.expectCallWith().resolves({
      state: 'idle',
    });

    render(<DevDock apiClient={mockApiClient} />);
    const dropdown = await screen.findByLabelText('Thermal Printer:');
    await waitFor(() => {
      expect(dropdown).toHaveValue('idle');
    });

    mockApiClient.setFujitsuPrinterStatus
      .expectCallWith({ state: 'no-paper' })
      .resolves();
    mockApiClient.getFujitsuPrinterStatus.expectCallWith().resolves({
      state: 'no-paper',
    });
    userEvent.selectOptions(dropdown, screen.getByText('no-paper'));
    await waitFor(() => {
      expect(dropdown).toHaveValue('no-paper');
    });
  });
});
