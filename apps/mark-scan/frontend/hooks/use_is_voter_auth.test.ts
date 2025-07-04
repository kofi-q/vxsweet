import { renderHook } from '@testing-library/react';
import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { advancePromises } from '@vx/libs/test-utils/src';
import { useIsVoterAuth } from './use_is_voter_auth';
import {
  type ApiMock,
  createApiMock,
  provideApi,
} from '../test/helpers/mock_api_client';
const electionGeneralDefinition = electionGeneral.toElectionDefinition();

let apiMock: ApiMock;

beforeEach(() => {
  apiMock = createApiMock();
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
});

test('with voter auth', async () => {
  apiMock.setAuthStatusCardlessVoterLoggedInWithDefaults(
    electionGeneralDefinition
  );

  const { result } = renderHook(useIsVoterAuth, {
    wrapper: ({ children }) => provideApi(apiMock, children),
  });
  await advancePromises();

  expect(result.current).toEqual(true);
});

test('with non-voter auth', async () => {
  apiMock.setAuthStatusPollWorkerLoggedIn(electionGeneralDefinition);

  const { result } = renderHook(useIsVoterAuth, {
    wrapper: ({ children }) => provideApi(apiMock, children),
  });
  await advancePromises();

  expect(result.current).toEqual(false);
});
