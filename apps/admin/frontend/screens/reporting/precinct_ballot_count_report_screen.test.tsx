import '../../test/set_up_react_pdf_mock';

import * as electionFamousNames2021Fixtures from '@vx/libs/fixtures/src/data/electionFamousNames2021';
import * as electionTwoPartyPrimaryFixtures from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary';
import {
  type ApiMock,
  createApiMock,
} from '../../test/helpers/mock_api_client';
import { renderInAppContext } from '../../test/render_in_app_context';
import { screen } from '../../test/react_testing_library';
import {
  PrecinctBallotCountReport,
  TITLE,
} from './precinct_ballot_count_report_screen';

let apiMock: ApiMock;

beforeEach(() => {
  apiMock = createApiMock();
});

afterEach(() => {
  apiMock.assertComplete();
});

test('displays report (primary)', async () => {
  const electionDefinition =
    electionTwoPartyPrimaryFixtures.electionJson.toElectionDefinition();
  apiMock.expectGetCastVoteRecordFileMode('official');
  apiMock.setPrinterStatus({ connected: true });
  apiMock.expectGetBallotCountReportPreview({
    reportSpec: {
      filter: {},
      groupBy: { groupByPrecinct: true, groupByParty: true },
      includeSheetCounts: false,
    },
    pdfContent: 'Precinct Ballot Count Report Mock Preview',
  });

  renderInAppContext(<PrecinctBallotCountReport />, {
    electionDefinition,
    apiMock,
    isOfficialResults: false,
  });

  await screen.findByText('Precinct Ballot Count Report Mock Preview');

  screen.getByRole('heading', { name: TITLE });
  expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute(
    'href',
    '/reports'
  );
});

test('displays report (general)', async () => {
  const electionDefinition =
    electionFamousNames2021Fixtures.electionJson.toElectionDefinition();
  apiMock.expectGetCastVoteRecordFileMode('official');
  apiMock.setPrinterStatus({ connected: true });
  apiMock.expectGetBallotCountReportPreview({
    reportSpec: {
      filter: {},
      groupBy: { groupByParty: false, groupByPrecinct: true },
      includeSheetCounts: false,
    },
    pdfContent: 'Precinct Ballot Count Report Mock Preview',
  });

  renderInAppContext(<PrecinctBallotCountReport />, {
    electionDefinition,
    apiMock,
    isOfficialResults: false,
  });

  await screen.findByText('Precinct Ballot Count Report Mock Preview');

  screen.getByRole('heading', { name: TITLE });
  expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute(
    'href',
    '/reports'
  );
});
