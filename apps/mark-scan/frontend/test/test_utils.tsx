import { createMemoryHistory, History } from 'history';
import React from 'react';
import { Router } from 'react-router-dom';
import {
  type BallotStyleId,
  type Contests,
  type ElectionDefinition,
  type PrecinctId,
  type VotesDict,
} from '@vx/libs/types/elections';
import { type MachineConfig } from '../../backend/types/types';

import { randomBallotId } from '@vx/libs/utils/src';
import { render as testRender } from './react_testing_library';
import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';

import { BallotContext } from '../contexts/ballot_context';
import { mockMachineConfig } from './helpers/mock_machine_config';
import { type ApiMock, createApiMock } from './helpers/mock_api_client';
import { ApiProvider } from '../api/api_provider';

export function render(
  component: React.ReactNode,
  {
    route = '/',
    ballotStyleId,
    electionDefinition = electionGeneral.toElectionDefinition(),
    contests = electionDefinition.election.contests,
    endVoterSession = jest.fn(),
    history = createMemoryHistory({ initialEntries: [route] }),
    generateBallotId = randomBallotId,
    isCardlessVoter = false,
    isLiveMode = false,
    machineConfig = mockMachineConfig(),
    precinctId,
    resetBallot = jest.fn(),
    updateVote = jest.fn(),
    votes = {},
    apiMock = createApiMock(),
  }: {
    route?: string;
    ballotStyleId?: BallotStyleId;
    electionDefinition?: ElectionDefinition;
    contests?: Contests;
    endVoterSession?: () => Promise<void>;
    history?: History;
    generateBallotId?: () => string;
    isCardlessVoter?: boolean;
    isLiveMode?: boolean;
    machineConfig?: MachineConfig;
    precinctId?: PrecinctId;
    resetBallot?(): void;
    setUserSettings?(): void;
    updateTally?(): void;
    updateVote?(): void;
    votes?: VotesDict;
    apiMock?: ApiMock;
  } = {}
): ReturnType<typeof testRender> {
  return {
    ...testRender(
      <ApiProvider apiClient={apiMock.mockApiClient}>
        <BallotContext.Provider
          value={{
            ballotStyleId,
            contests,
            electionDefinition,
            generateBallotId,
            isCardlessVoter,
            isLiveMode,
            machineConfig,
            endVoterSession,
            precinctId,
            resetBallot,
            updateVote,
            votes,
          }}
        >
          <Router history={history}>{component}</Router>
        </BallotContext.Provider>
      </ApiProvider>
    ),
  };
}
