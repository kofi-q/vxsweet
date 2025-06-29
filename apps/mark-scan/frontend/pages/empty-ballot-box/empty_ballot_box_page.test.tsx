import userEvent from '@testing-library/user-event';
import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { render } from '../../test/test_utils';
import {
  createApiMock,
  type ApiMock,
} from '../../test/helpers/mock_api_client';
import { screen } from '../../test/react_testing_library';
import { EmptyBallotBoxPage } from './empty_ballot_box_page';
import {
  mockCardlessVoterLoggedInAuth,
  mockPollWorkerAuth,
} from '../../test/helpers/mock_auth';
const electionGeneralDefinition = electionGeneral.toElectionDefinition();

let apiMock: ApiMock;

beforeEach(() => {
  apiMock = createApiMock();
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
});

test('requires poll worker auth', () => {
  const electionDefinition = electionGeneralDefinition;
  const authStatus = mockCardlessVoterLoggedInAuth(electionDefinition);
  render(<EmptyBallotBoxPage authStatus={authStatus} />, {
    apiMock,
  });

  screen.getByText('Insert a poll worker card to continue.');
});

test('calls expectConfirmBallotBoxEmptied when button is clicked', () => {
  const electionDefinition = electionGeneralDefinition;
  apiMock.expectConfirmBallotBoxEmptied();
  const authStatus = mockPollWorkerAuth(electionDefinition);
  render(<EmptyBallotBoxPage authStatus={authStatus} />, {
    apiMock,
  });

  userEvent.click(screen.getByText('Yes, Ballot Box is Empty'));
});
