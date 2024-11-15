import '../../test/set_up_react_pdf_mock';

import * as electionGridLayoutNewHampshireTestBallotFixtures from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot';

import userEvent from '@testing-library/user-event';
import { ok } from '@vx/libs/basics/result';
import { mockUsbDriveStatus } from '@vx/libs/ui/test-utils/mock_usb_drive';
import { renderInAppContext } from '../../test/render_in_app_context';
import {
  type ApiMock,
  createApiMock,
} from '../../test/helpers/mock_api_client';
import {
  TITLE,
  TallyWriteInReportScreen,
} from './write_in_adjudication_report_screen';
import {
  screen,
  waitForElementToBeRemoved,
  within,
} from '../../test/react_testing_library';

let apiMock: ApiMock;

beforeEach(() => {
  jest.useFakeTimers();
  apiMock = createApiMock();
});

afterAll(() => {
  apiMock.assertComplete();
});

test('renders provided data', async () => {
  const electionDefinition =
    electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionDefinition();
  apiMock.expectGetCastVoteRecordFileMode('official');
  apiMock.setPrinterStatus({ connected: true });
  apiMock.expectGetWriteInAdjudicationReportPreview(
    'Mock Write-In Adjudication Report'
  );
  renderInAppContext(<TallyWriteInReportScreen />, {
    electionDefinition,
    apiMock,
    usbDriveStatus: mockUsbDriveStatus('mounted'),
  });
  await screen.findByText('Mock Write-In Adjudication Report');

  await screen.findByRole('heading', { name: TITLE });
  expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute(
    'href',
    '/reports'
  );

  apiMock.apiClient.printWriteInAdjudicationReport.expectCallWith().resolves();
  userEvent.click(screen.getButton('Print Report'));
  const printModal = await screen.findByRole('alertdialog');
  await waitForElementToBeRemoved(printModal);

  jest.setSystemTime(new Date('2021-01-01T00:00:00'));
  apiMock.apiClient.exportWriteInAdjudicationReportPdf
    .expectCallWith({
      path: 'test-mount-point/test-ballot_general-election_c5d895d735/reports/unofficial-full-election-write-in-adjudication-report__2021-01-01_00-00-00.pdf',
    })
    .resolves(ok([]));
  userEvent.click(screen.getButton('Export Report PDF'));
  const exportModal = await screen.findByRole('alertdialog');
  userEvent.click(within(exportModal).getButton('Save'));
  await screen.findByText('Write-In Adjudication Report Saved');
  userEvent.click(within(exportModal).getButton('Close'));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

test('shows warning and prevents actions when PDF is too large', async () => {
  const electionDefinition =
    electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionDefinition();
  apiMock.expectGetCastVoteRecordFileMode('official');
  apiMock.setPrinterStatus({ connected: true });
  apiMock.apiClient.getWriteInAdjudicationReportPreview
    .expectCallWith()
    .resolves({
      pdf: undefined,
      warning: { type: 'content-too-large' },
    });
  renderInAppContext(<TallyWriteInReportScreen />, {
    electionDefinition,
    apiMock,
    usbDriveStatus: mockUsbDriveStatus('mounted'),
  });
  await screen.findByRole('heading', { name: TITLE });
  await screen.findByText('This report is too large to export.');
  for (const buttonLabel of ['Print Report', 'Export Report PDF']) {
    expect(screen.getButton(buttonLabel)).toBeDisabled();
  }
});
