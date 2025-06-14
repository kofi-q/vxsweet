import '../../test/set_up_react_pdf_mock';

import * as electionFamousNames2021Fixtures from '@vx/libs/fixtures/src/data/electionFamousNames2021';
import * as electionTwoPartyPrimary from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary/election.json';
import userEvent from '@testing-library/user-event';
import {
  type ApiMock,
  createApiMock,
} from '../../test/helpers/mock_api_client';
import { renderInAppContext } from '../../test/render_in_app_context';
import { screen, waitFor, within } from '../../test/react_testing_library';
import { canonicalizeFilter, canonicalizeGroupBy } from '../../utils/reporting';
import { BallotCountReportBuilder, TITLE } from './ballot_count_report_builder';

jest.setTimeout(20_000);

const electionTwoPartyPrimaryDefinition =
  electionTwoPartyPrimary.toElectionDefinition();

let apiMock: ApiMock;

beforeEach(() => {
  apiMock = createApiMock();
  apiMock.setPrinterStatus({ connected: true });
});

afterEach(() => {
  apiMock.assertComplete();
});

test('happy path', async () => {
  const electionDefinition = electionTwoPartyPrimaryDefinition;

  apiMock.expectGetCastVoteRecordFileMode('test');
  apiMock.expectGetScannerBatches([]);
  renderInAppContext(<BallotCountReportBuilder />, {
    electionDefinition,
    apiMock,
  });

  screen.getByRole('heading', { name: TITLE });
  expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute(
    'href',
    '/reports'
  );

  expect(screen.queryByText('Load Preview')).not.toBeInTheDocument();
  expect(screen.getButton('Print Report')).toBeDisabled();

  // Add Filter
  userEvent.click(screen.getByText('Add Filter'));
  userEvent.click(screen.getByLabelText('Select New Filter Type'));
  expect(
    within(screen.getByTestId('filter-editor')).queryByText('Party')
  ).toBeInTheDocument(); // party should be option for primaries, although we don't select it now
  userEvent.click(
    within(screen.getByTestId('filter-editor')).getByText('Voting Method')
  );
  screen.getByText('is');
  userEvent.click(screen.getByLabelText('Select Filter Values'));
  userEvent.click(screen.getByText('Absentee'));

  await waitFor(() => {
    expect(screen.getButton('Generate Report')).toBeEnabled();
  });
  expect(screen.getButton('Print Report')).toBeDisabled();

  // Add Group By
  const precinctCheckbox = screen.getByRole('checkbox', { name: 'Precinct' });
  userEvent.click(precinctCheckbox);
  expect(precinctCheckbox).toBeChecked();
  const partyCheckbox = screen.getByRole('checkbox', { name: 'Party' });
  userEvent.click(partyCheckbox);
  expect(partyCheckbox).toBeChecked();

  // Load Preview
  apiMock.expectGetBallotCountReportPreview({
    reportSpec: {
      filter: canonicalizeFilter({
        votingMethods: ['absentee'],
      }),
      groupBy: canonicalizeGroupBy({
        groupByPrecinct: true,
        groupByParty: true,
      }),
      includeSheetCounts: false,
    },
    pdfContent: 'Test Unofficial Absentee Ballot Ballot Count Report',
  });
  userEvent.click(screen.getButton('Generate Report'));

  await screen.findByText(
    'Test Unofficial Absentee Ballot Ballot Count Report'
  );

  // Change Report Parameters
  userEvent.click(screen.getByLabelText('Remove Absentee'));
  userEvent.click(screen.getByLabelText('Select Filter Values'));
  userEvent.click(
    within(screen.getByTestId('filter-editor')).getByText('Precinct')
  );

  // Refresh Preview
  apiMock.expectGetBallotCountReportPreview({
    reportSpec: {
      filter: canonicalizeFilter({
        votingMethods: ['precinct'],
      }),
      groupBy: canonicalizeGroupBy({
        groupByPrecinct: true,
        groupByParty: true,
      }),
      includeSheetCounts: false,
    },
    pdfContent: 'Test Unofficial Precinct Ballot Ballot Count Report',
  });
  userEvent.click(screen.getByText('Generate Report'));

  await screen.findByText(
    'Test Unofficial Precinct Ballot Ballot Count Report'
  );
});

test('does not show party options for non-primary elections', () => {
  const electionDefinition =
    electionFamousNames2021Fixtures.electionJson.toElectionDefinition();

  apiMock.expectGetCastVoteRecordFileMode('test');
  apiMock.expectGetScannerBatches([]);
  renderInAppContext(<BallotCountReportBuilder />, {
    electionDefinition,
    apiMock,
  });

  expect(screen.queryByText('Load Preview')).not.toBeInTheDocument();

  // no group by
  expect(screen.queryByLabelText('Party')).not.toBeInTheDocument();

  // no filter
  userEvent.click(screen.getByText('Add Filter'));
  userEvent.click(screen.getByLabelText('Select New Filter Type'));
  expect(
    within(screen.getByTestId('filter-editor')).queryByText('Party')
  ).not.toBeInTheDocument();
});

test('shows sheet option for multi-sheet elections', () => {
  const electionDefinition =
    electionFamousNames2021Fixtures.asMultiSheetElectionDefinition();

  apiMock.expectGetCastVoteRecordFileMode('test');
  apiMock.expectGetScannerBatches([]);
  renderInAppContext(<BallotCountReportBuilder />, {
    electionDefinition,
    apiMock,
  });

  screen.getByRole('checkbox', { name: 'Sheet', checked: false });
});
