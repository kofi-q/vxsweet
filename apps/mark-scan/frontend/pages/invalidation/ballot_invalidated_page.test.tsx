import userEvent from '@testing-library/user-event';
import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { InsertedSmartCardAuth } from '@vx/libs/types/elections';
import { type VxRenderResult } from '@vx/libs/ui/themes';
import { render } from '../../test/test_utils';
import {
  createApiMock,
  type ApiMock,
} from '../../test/helpers/mock_api_client';
import { screen } from '../../test/react_testing_library';
import { BallotInvalidatedPage } from './ballot_invalidated_page';
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

function renderWithAuthAndBallotContext(
  authStatus:
    | InsertedSmartCardAuth.CardlessVoterLoggedIn
    | InsertedSmartCardAuth.PollWorkerLoggedIn,
  paperPresent: boolean = true
): VxRenderResult {
  return render(
    <BallotInvalidatedPage
      authStatus={authStatus}
      paperPresent={paperPresent}
    />,
    {
      apiMock,
    }
  );
}

describe('with poll worker auth', () => {
  test('renders the correct message when paper is present', () => {
    const electionDefinition = electionGeneralDefinition;
    const auth = mockPollWorkerAuth(electionDefinition);
    renderWithAuthAndBallotContext(auth);

    screen.getByText('Please remove the incorrect ballot.');
  });

  test('renders the correct message when paper is not present', () => {
    const electionDefinition = electionGeneralDefinition;
    const auth = mockPollWorkerAuth(electionDefinition);
    renderWithAuthAndBallotContext(auth, false);

    screen.getByText(
      'The incorrect ballot has been removed. Remember to spoil the ballot.'
    );
  });

  test('calls confirmInvalidateBallot when button is clicked', () => {
    const electionDefinition = electionGeneralDefinition;
    apiMock.expectConfirmInvalidateBallot();
    const auth = mockPollWorkerAuth(electionDefinition);
    renderWithAuthAndBallotContext(auth, false);

    userEvent.click(screen.getByText('Continue'));
  });
});

describe('with cardless voter auth', () => {
  test('renders instructions to alert a poll worker', async () => {
    const electionDefinition = electionGeneralDefinition;

    const auth = mockCardlessVoterLoggedInAuth(electionDefinition);
    renderWithAuthAndBallotContext(auth);

    await screen.findByText('Ask a poll worker for help');
    await screen.findByText('Insert a poll worker card to continue.');
  });
});
