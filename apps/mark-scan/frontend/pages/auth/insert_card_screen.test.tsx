import { ALL_PRECINCTS_SELECTION } from '@vx/libs/utils/src';
import { screen } from '../../test/react_testing_library';
import {
  type ApiMock,
  createApiMock,
} from '../../test/helpers/mock_api_client';
import { render } from '../../test/test_utils';
import { InsertCardScreen } from './insert_card_screen';
import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { ApiProvider } from '../../api/api_provider';
const electionDefinition = electionGeneral.toElectionDefinition();

let apiMock: ApiMock;

beforeEach(() => {
  apiMock = createApiMock();
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
});

test('renders correctly', async () => {
  render(
    <ApiProvider apiClient={apiMock.mockApiClient} noAudio>
      <InsertCardScreen
        appPrecinct={ALL_PRECINCTS_SELECTION}
        electionDefinition={electionDefinition}
        electionPackageHash="test-election-package-hash"
        showNoChargerAttachedWarning={false}
        isLiveMode={false}
        pollsState="polls_closed_initial"
      />
    </ApiProvider>
  );
  expect(await screen.findByText('Election ID')).toBeDefined();
});
