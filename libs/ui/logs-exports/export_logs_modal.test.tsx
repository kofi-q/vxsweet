import { err, ok } from '@vx/libs/basics/result';
import userEvent from '@testing-library/user-event';
import { type UsbDriveStatus } from '@vx/libs/usb-drive/src';
import { screen } from '../test/react_testing_library';
import { ExportLogsButton } from './export_logs_modal';
import { mockUsbDriveStatus } from '../test-utils/mock_usb_drive';
import { newTestContext } from '../test/test_context';

const { mockApiClient, render } = newTestContext({
  skipUiStringsApi: true,
});

test('renders no log file found when usb is mounted but no log file on machine', async () => {
  mockApiClient.exportLogsToUsb.mockResolvedValueOnce(err('no-logs-directory'));

  render(<ExportLogsButton usbDriveStatus={mockUsbDriveStatus('mounted')} />);
  userEvent.click(screen.getByText('Save Log File'));
  userEvent.click(screen.getByText('Save'));
  await screen.findByText('Failed to save log file. no-logs-directory');
  expect(mockApiClient.exportLogsToUsb).toHaveBeenCalledTimes(1);
});

test('render no usb found screen when there is not a mounted usb drive', async () => {
  const usbStatuses: UsbDriveStatus[] = [
    { status: 'no_drive' },
    { status: 'ejected' },
  ];
  for (const status of usbStatuses) {
    const { unmount } = render(<ExportLogsButton usbDriveStatus={status} />);
    userEvent.click(screen.getByText('Save Log File'));
    await screen.findByText('No USB Drive Detected');
    screen.getByText(
      'Please insert a USB drive where you would like the save the log file.'
    );
    screen.getByAltText('Insert USB Image');

    userEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByRole('alertdialog')).toBeFalsy();

    unmount();
  }
});

test('successful save default logs flow', async () => {
  mockApiClient.exportLogsToUsb.mockResolvedValueOnce(ok());

  render(<ExportLogsButton usbDriveStatus={mockUsbDriveStatus('mounted')} />);
  userEvent.click(screen.getByText('Save Log File'));
  await screen.findByText('Save Logs');
  userEvent.click(screen.getByText('Save'));
  await screen.findByText(/Saving Logs/);
  await screen.findByText(/Logs Saved/);

  userEvent.click(screen.getByText('Close'));
  expect(screen.queryByRole('alertdialog')).toBeFalsy();

  expect(mockApiClient.exportLogsToUsb).toHaveBeenCalledTimes(1);
  expect(mockApiClient.exportLogsToUsb).toHaveBeenCalledWith({ format: 'vxf' });
});

test('successful save cdf logs flow', async () => {
  mockApiClient.exportLogsToUsb.mockResolvedValueOnce(ok());

  render(<ExportLogsButton usbDriveStatus={mockUsbDriveStatus('mounted')} />);
  userEvent.click(screen.getByText('Save Log File'));
  await screen.findByText('Save Logs');

  userEvent.click(screen.getByText('CDF'));
  await screen.findByText(
    'It may take a few minutes to save logs in this format.'
  );

  userEvent.click(screen.getByText('Save'));
  await screen.findByText(/Saving Logs/);
  await screen.findByText(/Logs Saved/);
  userEvent.click(screen.getByText('Close'));
  expect(screen.queryByRole('alertdialog')).toBeFalsy();

  expect(mockApiClient.exportLogsToUsb).toHaveBeenCalledTimes(1);
  expect(mockApiClient.exportLogsToUsb).toHaveBeenCalledWith({ format: 'cdf' });
});

test('successful save error logs flow', async () => {
  mockApiClient.exportLogsToUsb.mockResolvedValueOnce(ok());

  render(<ExportLogsButton usbDriveStatus={mockUsbDriveStatus('mounted')} />);
  userEvent.click(screen.getByText('Save Log File'));
  await screen.findByText('Save Logs');

  userEvent.click(screen.getByText('Errors'));
  await screen.findByText(
    'It may take a few minutes to save logs in this format.'
  );

  userEvent.click(screen.getByText('Save'));
  await screen.findByText(/Saving Logs/);
  await screen.findByText(/Logs Saved/);

  userEvent.click(screen.getByText('Close'));
  expect(screen.queryByRole('alertdialog')).toBeFalsy();

  expect(mockApiClient.exportLogsToUsb).toHaveBeenCalledTimes(1);
  expect(mockApiClient.exportLogsToUsb).toHaveBeenCalledWith({ format: 'err' });
});
