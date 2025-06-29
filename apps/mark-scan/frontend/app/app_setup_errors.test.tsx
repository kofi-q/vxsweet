import { ALL_PRECINCTS_SELECTION } from '@vx/libs/utils/src';

import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { BATTERY_POLLING_INTERVAL_GROUT } from '@vx/libs/ui/system-calls';
import {
  act,
  render,
  screen,
  waitForElementToBeRemoved,
} from '../test/react_testing_library';
const electionGeneralDefinition = electionGeneral.toElectionDefinition();

import { App } from './app';

import { advanceTimersAndPromises } from '../test/helpers/timers';

import { withMarkup } from '../test/helpers/with_markup';
import { type ApiMock, createApiMock } from '../test/helpers/mock_api_client';
import { LOW_BATTERY_THRESHOLD } from '../config/constants';

let apiMock: ApiMock;

beforeEach(() => {
  jest.useFakeTimers();
  window.location.href = '/';
  apiMock = createApiMock();
  apiMock.expectGetSystemSettings();
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
});

const insertCardScreenText = 'Insert Card';
const lowBatteryErrorScreenText = 'No Power Detected and Battery is Low';
const noPowerDetectedWarningText = 'No Power Detected.';

describe('Displays setup warning messages and errors screens', () => {
  it('Displays error screen if Card Reader connection is lost', async () => {
    apiMock.expectGetMachineConfig();
    apiMock.expectGetElectionRecord(electionGeneralDefinition);
    apiMock.expectGetElectionState({
      precinctSelection: ALL_PRECINCTS_SELECTION,
      pollsState: 'polls_open',
    });

    render(<App apiClient={apiMock.mockApiClient} />);

    // Start on Insert Card screen
    await screen.findByText(insertCardScreenText);

    // Disconnect Card Reader
    apiMock.setAuthStatusLoggedOut('no_card_reader');
    await advanceTimersAndPromises();
    screen.getByText('Card Reader Not Detected');

    // Reconnect Card Reader
    apiMock.setAuthStatusLoggedOut();
    await advanceTimersAndPromises();
    screen.getByText(insertCardScreenText);
  });

  it('Displays error screen if Power connection is lost', async () => {
    apiMock.expectGetMachineConfig();
    apiMock.expectGetElectionRecord(electionGeneralDefinition);
    apiMock.expectGetElectionState({
      precinctSelection: ALL_PRECINCTS_SELECTION,
      pollsState: 'polls_open',
    });

    render(<App apiClient={apiMock.mockApiClient} />);

    await screen.findByText('Insert Card');

    // Disconnect Power
    act(() => {
      apiMock.setBatteryInfo({ level: 1, discharging: true });
    });
    await screen.findByText(noPowerDetectedWarningText);

    // Reconnect Power
    act(() => {
      apiMock.setBatteryInfo({ level: 1, discharging: false });
    });
    await waitForElementToBeRemoved(
      screen.queryByText(noPowerDetectedWarningText)
    );
  });

  it('Displays "discharging battery" warning message and "discharging battery + low battery" error screen', async () => {
    apiMock.expectGetMachineConfig();
    apiMock.expectGetElectionRecord(electionGeneralDefinition);
    apiMock.expectGetElectionState({
      precinctSelection: ALL_PRECINCTS_SELECTION,
      pollsState: 'polls_open',
    });

    render(<App apiClient={apiMock.mockApiClient} />);
    const findByTextWithMarkup = withMarkup(screen.findByText);

    // Start on Insert Card screen
    await screen.findByText(insertCardScreenText);

    // Remove charger and reduce battery level slightly
    act(() => {
      apiMock.setBatteryInfo({ level: 0.6, discharging: true });
    });
    await screen.findByText(noPowerDetectedWarningText);
    screen.getByText(insertCardScreenText);

    // Battery level drains below low threshold
    act(() => {
      apiMock.setBatteryInfo({
        level: LOW_BATTERY_THRESHOLD / 2,
        discharging: true,
      });
    });
    await findByTextWithMarkup(lowBatteryErrorScreenText);

    // Attach charger and back on Insert Card screen
    act(() => {
      apiMock.setBatteryInfo({
        level: LOW_BATTERY_THRESHOLD / 2,
        discharging: false,
      });
    });
    await screen.findByText(insertCardScreenText);
    expect(screen.queryByText(noPowerDetectedWarningText)).toBeFalsy();

    // Unplug charger and show warning again
    act(() => {
      apiMock.setBatteryInfo({
        level: LOW_BATTERY_THRESHOLD / 2,
        discharging: true,
      });
    });
    await advanceTimersAndPromises(BATTERY_POLLING_INTERVAL_GROUT / 1000);
    await findByTextWithMarkup(lowBatteryErrorScreenText);

    // Remove battery, i.e. we're on a desktop
    act(() => {
      apiMock.setBatteryInfo();
    });
    await screen.findByText(insertCardScreenText);
    expect(screen.queryByText(noPowerDetectedWarningText)).toBeFalsy();
  });

  it('displays paper handler connection error if no paper handler', async () => {
    apiMock.setPaperHandlerState('no_hardware');
    apiMock.expectGetMachineConfig();
    apiMock.expectGetElectionRecord(electionGeneralDefinition);
    apiMock.expectGetElectionState({
      precinctSelection: ALL_PRECINCTS_SELECTION,
      pollsState: 'polls_open',
    });

    render(<App apiClient={apiMock.mockApiClient} />);

    await screen.findByText('Internal Connection Problem');

    screen.getByText('Ask a poll worker to restart the machine.');
  });
});
