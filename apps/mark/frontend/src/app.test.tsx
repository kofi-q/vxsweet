jest.mock(
  '@vx/libs/mark-flow-ui/src',
  (): typeof import('@vx/libs/mark-flow-ui/src') => ({
    ...jest.requireActual('@vx/libs/mark-flow-ui/src'),
    useBallotStyleManager: jest.fn(),
    useSessionSettingsManager: jest.fn(),
  })
);

import React from 'react';
import { mockOf, suppressingConsoleOutput } from '@vx/libs/test-utils/src';
import { ALL_PRECINCTS_SELECTION } from '@vx/libs/utils/src';

import fetchMock from 'fetch-mock';
import { electionGeneralDefinition } from '@vx/libs/fixtures/src';
import {
  useBallotStyleManager,
  useSessionSettingsManager,
} from '@vx/libs/mark-flow-ui/src';
import userEvent from '@testing-library/user-event';
import { BallotStyleId } from '@vx/libs/types/src';
import { screen } from '../test/react_testing_library';
import { advanceTimersAndPromises } from '../test/helpers/timers';
import { render } from '../test/test_utils';
import { App } from './app';
import { ApiMock, createApiMock } from '../test/helpers/mock_api_client';
import { buildApp } from '../test/helpers/build_app';


let apiMock: ApiMock;

beforeEach(() => {
  jest.useFakeTimers();
  apiMock = createApiMock();

  mockOf(useSessionSettingsManager).mockReturnValue({
    onSessionEnd: jest.fn(),
  });
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
  mockOf(useSessionSettingsManager).mockReset();
});

it('will throw an error when using default api', async () => {
  fetchMock.get('/api', {
    body: {
      machineId: '0002',
      codeVersion: '3.14',
    },
  });

  await suppressingConsoleOutput(async () => {
    render(<App />);
    await screen.findByText('Something went wrong');
  });
});

it('Displays error boundary if the api returns an unexpected error', async () => {
  apiMock.expectGetSystemSettings();
  apiMock.expectGetElectionRecord(null);
  apiMock.expectGetElectionState();
  apiMock.expectGetMachineConfigToError();
  await suppressingConsoleOutput(async () => {
    render(<App apiClient={apiMock.mockApiClient} reload={jest.fn()} />);
    await advanceTimersAndPromises();
    screen.getByText('Something went wrong');
  });
});

it('prevents context menus from appearing', async () => {
  apiMock.expectGetMachineConfig();
  apiMock.expectGetSystemSettings();
  apiMock.expectGetElectionRecord(null);
  apiMock.expectGetElectionState();
  render(<App apiClient={apiMock.mockApiClient} reload={jest.fn()} />);

  const { oncontextmenu } = window;

  if (oncontextmenu) {
    const event = new MouseEvent('contextmenu');

    jest.spyOn(event, 'preventDefault');
    oncontextmenu.call(window, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  }

  await advanceTimersAndPromises();
});

it('uses voter settings management hook', async () => {
  apiMock.expectGetMachineConfig();
  apiMock.expectGetSystemSettings();
  apiMock.expectGetElectionRecord(electionGeneralDefinition);
  apiMock.expectGetElectionState();

  const { renderApp } = buildApp(apiMock);
  renderApp();

  await advanceTimersAndPromises();

  expect(mockOf(useSessionSettingsManager)).toBeCalled();
});

it('uses ballot style management hook', async () => {
  apiMock.expectGetMachineConfig();
  apiMock.expectGetSystemSettings();
  apiMock.expectGetElectionRecord(electionGeneralDefinition);
  apiMock.expectGetElectionState();
  apiMock.setAuthStatusCardlessVoterLoggedIn({
    ballotStyleId: '1_G_es-US' as BallotStyleId,
    precinctId: electionGeneralDefinition.election.precincts[0].id,
  });
  apiMock.mockApiClient.updateCardlessVoterBallotStyle
    .expectRepeatedCallsWith({
      ballotStyleId: '1_es-US' as BallotStyleId,
    })
    .resolves();

  mockOf(useBallotStyleManager).mockImplementation((params) =>
    React.useEffect(() => {
      params.updateCardlessVoterBallotStyle({
        ballotStyleId: '1_es-US' as BallotStyleId,
      });
    }, [params])
  );

  buildApp(apiMock).renderApp();

  await advanceTimersAndPromises();

  expect(mockOf(useBallotStyleManager)).toBeCalledWith(
    expect.objectContaining({
      currentBallotStyleId: '1_G_es-US',
      electionDefinition: electionGeneralDefinition,
    })
  );
});

// This test is only really here to provide coverage for the default value for
// `App`'s `reload` prop.
it('uses window.location.reload by default', async () => {
  // Stub location in a way that's good enough for this test, but not good
  // enough for general `window.location` use.
  const reload = jest.fn();
  apiMock.expectGetMachineConfig();
  apiMock.expectGetSystemSettings();
  jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    reload,
  });

  // Set up in an already-configured state.
  const electionDefinition = electionGeneralDefinition;
  apiMock.expectGetElectionRecord(electionDefinition);
  apiMock.expectGetElectionState({
    precinctSelection: ALL_PRECINCTS_SELECTION,
  });

  render(<App apiClient={apiMock.mockApiClient} />);

  await advanceTimersAndPromises();

  // Force refresh
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition);
  await advanceTimersAndPromises();
  userEvent.click(await screen.findByText('Reset Accessible Controller'));
  expect(reload).toHaveBeenCalledTimes(1);
});
