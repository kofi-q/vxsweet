import userEvent from '@testing-library/user-event';
import { type Result, err, ok } from '@vx/libs/basics/result';
import { deferred } from '@vx/libs/basics/async';
import { type UsbDriveStatus } from '@vx/libs/usb-drive/src';
import { mockUsbDriveStatus } from '@vx/libs/ui/test-utils/mock_usb_drive';
import { type ExportDataError } from '@vx/libs/backend/exporter';
import { screen, waitFor, within } from '../test/react_testing_library';
import { renderInAppContext } from '../test/render_in_app_context';
import { ExportElectionPackageModalButton } from './export_election_package_modal_button';
import { type ApiMock, createApiMock } from '../test/helpers/mock_api_client';

let apiMock: ApiMock;

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(2023, 0, 1));
  apiMock = createApiMock();
});

afterEach(() => {
  jest.useRealTimers();
  apiMock.assertComplete();
});

test('Button renders properly when not clicked', () => {
  renderInAppContext(<ExportElectionPackageModalButton />, {
    apiMock,
  });

  screen.getButton('Save Election Package');
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

test.each<{
  usbStatus: UsbDriveStatus['status'];
}>([
  { usbStatus: 'no_drive' },
  { usbStatus: 'ejected' },
  { usbStatus: 'error' },
])(
  'Modal renders insert usb screen appropriately for status $usbStatus',
  async ({ usbStatus }) => {
    renderInAppContext(<ExportElectionPackageModalButton />, {
      usbDriveStatus: mockUsbDriveStatus(usbStatus),
      apiMock,
    });
    userEvent.click(screen.getButton('Save Election Package'));
    await waitFor(() => screen.getByText('No USB Drive Detected'));
    screen.getByText(
      'Please insert a USB drive in order to save the election package.'
    );

    userEvent.click(screen.getButton('Cancel'));
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    );
  }
);

test('Modal renders export confirmation screen when usb detected', async () => {
  renderInAppContext(<ExportElectionPackageModalButton />, {
    usbDriveStatus: mockUsbDriveStatus('mounted'),
    apiMock,
  });
  userEvent.click(
    await screen.findByRole('button', { name: 'Save Election Package' })
  );
  const modal = await screen.findByRole('alertdialog');
  within(modal).getByText('Save Election Package');
  within(modal).getByText(
    /An election package will be saved to the inserted USB drive./
  );

  const { promise, resolve } = deferred<Result<void, ExportDataError>>();
  apiMock.apiClient.saveElectionPackageToUsb.expectCallWith().returns(promise);
  userEvent.click(within(modal).getButton('Save'));
  expect(await within(modal).findButton('Saving...')).toBeDisabled();
  // Clicking outside the modal should not close it while the save is in progress.
  userEvent.click(modal.parentElement!);
  screen.getByRole('alertdialog');
  resolve(ok());
  await within(modal).findByText('Election Package Saved');

  screen.getByText(
    'You may now eject the USB drive. Use the saved election package on the USB drive to configure VxSuite components.'
  );

  apiMock.expectEjectUsbDrive();
  userEvent.click(screen.getButton('Eject USB'));

  userEvent.click(screen.getButton('Close'));
  await waitFor(() =>
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  );
});

test('Modal renders error message appropriately', async () => {
  renderInAppContext(<ExportElectionPackageModalButton />, {
    apiMock,
    usbDriveStatus: mockUsbDriveStatus('mounted'),
  });
  userEvent.click(screen.getButton('Save Election Package'));
  await screen.findByRole('heading', { name: 'Save Election Package' });

  apiMock.expectSaveElectionPackageToUsb(
    err({ type: 'missing-usb-drive', message: '' })
  );
  userEvent.click(screen.getButton('Save'));

  await screen.findByRole('heading', {
    name: 'Failed to Save Election Package',
  });
  screen.getByText(/An error occurred: No USB drive detected/);

  userEvent.click(screen.getButton('Close'));
  await waitFor(() =>
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  );
});
