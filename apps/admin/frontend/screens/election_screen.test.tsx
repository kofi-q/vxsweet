import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import {
  mockSystemAdministratorUser,
  mockSessionExpiresAt,
  mockElectionManagerUser,
} from '@vx/libs/test-utils/src';
import {
  constructElectionKey,
  DippedSmartCardAuth,
} from '@vx/libs/types/elections';
import { type ApiMock, createApiMock } from '../test/helpers/mock_api_client';
import { renderInAppContext } from '../test/render_in_app_context';
import { screen } from '../test/react_testing_library';
import { ElectionScreen } from './election_screen';
const electionGeneralDefinition = electionGeneral.toElectionDefinition();

const electionDefinition = electionGeneralDefinition;
const { election } = electionDefinition;

let apiMock: ApiMock;

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2022-06-22T00:00:00.000'));
  apiMock = createApiMock();
});

afterEach(() => {
  jest.useRealTimers();
  apiMock.assertComplete();
});

describe('as System Admin', () => {
  const auth: DippedSmartCardAuth.SystemAdministratorLoggedIn = {
    status: 'logged_in',
    user: mockSystemAdministratorUser(),
    sessionExpiresAt: mockSessionExpiresAt(),
    programmableCard: { status: 'no_card' },
  };

  test('renders election details', () => {
    renderInAppContext(<ElectionScreen />, {
      apiMock,
      auth,
      electionDefinition,
    });

    screen.getByText(
      'Configured with the current election at Wednesday, June 22, 2022 at 12:00:00 AM AKDT.'
    );
    screen.getByRole('heading', { name: election.title });
    screen.getByText(new RegExp(`${election.county.name}, ${election.state}`));
    screen.getByText('November 3, 2020');

    screen.getButton('Save Election Package');
    screen.getButton('Unconfigure Machine');
  });
});

describe('as election manager', () => {
  const auth: DippedSmartCardAuth.ElectionManagerLoggedIn = {
    status: 'logged_in',
    user: mockElectionManagerUser({
      electionKey: constructElectionKey(election),
    }),
    sessionExpiresAt: mockSessionExpiresAt(),
  };

  test('renders election details', () => {
    renderInAppContext(<ElectionScreen />, {
      apiMock,
      auth,
      electionDefinition,
    });

    screen.getByText(
      'Configured with the current election at Wednesday, June 22, 2022 at 12:00:00 AM AKDT.'
    );
    screen.getByRole('heading', { name: election.title });
    screen.getByText(new RegExp(`${election.county.name}, ${election.state}`));
    screen.getByText('November 3, 2020');

    screen.getButton('Save Election Package');
  });
});
