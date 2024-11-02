import React from 'react';
import {
  CastBallotPage,
  type ContestsWithMsEitherNeither,
  type MachineConfig,
  type UpdateVoteFunction,
} from '@vx/libs/mark-flow-ui/src';
import { randomBallotId } from '@vx/libs/utils/src';
import {
  type BallotStyleId,
  type ElectionDefinition,
  type PrecinctId,
  type VotesDict,
} from '@vx/libs/types/src';
import { type SimpleServerStatus } from '../../backend/src/custom-paper-handler/types';
import {
  MarkScanControllerSandbox,
  PatDeviceContextProvider,
  useAccessibleControllerHelpTrigger,
} from '@vx/libs/ui/src/accessible_controllers';
import { Ballot } from './components/ballot';
import { ValidateBallotPage } from './pages/validate_ballot_page';
import { BallotContext } from './contexts/ballot_context';
import * as api from './api';
import { PatDeviceCalibrationPage } from './pages/pat_device_identification/pat_device_calibration_page';
import {
  BallotReinsertionFlow,
  isBallotReinsertionState,
} from './ballot_reinsertion_flow';

export interface VoterFlowProps {
  contests: ContestsWithMsEitherNeither;
  electionDefinition: ElectionDefinition;
  machineConfig: MachineConfig;
  precinctId?: PrecinctId;
  ballotStyleId?: BallotStyleId;
  isLiveMode: boolean;
  updateVote: UpdateVoteFunction;
  resetBallot: (showPostVotingInstructions?: boolean) => void;
  endVoterSession: () => Promise<void>;
  stateMachineState: SimpleServerStatus;
  votes: VotesDict;
}

export function VoterFlow(props: VoterFlowProps): React.ReactNode {
  const { resetBallot, stateMachineState, ...rest } = props;

  const confirmSessionEndMutation = api.confirmSessionEnd.useMutation();
  const isPathDeviceConnected =
    api.getIsPatDeviceConnected.useQuery().data || false;

  const { shouldShowControllerSandbox } = useAccessibleControllerHelpTrigger();

  if (stateMachineState === 'pat_device_connected') {
    return <PatDeviceCalibrationPage />;
  }

  if (shouldShowControllerSandbox) {
    return <MarkScanControllerSandbox />;
  }

  let ballotContextProviderChild = <Ballot />;

  // Pages that condition on state machine state aren't nested under Ballot because Ballot uses
  // frontend browser routing for flow control and is completely independent of the state machine.
  // We still want to nest some pages that condition on the state machine under BallotContext so we render them here.
  if (stateMachineState === 'presenting_ballot') {
    ballotContextProviderChild = <ValidateBallotPage />;
  }

  if (stateMachineState === 'ballot_removed_during_presentation') {
    return (
      <CastBallotPage
        hidePostVotingInstructions={() => {
          resetBallot();
          confirmSessionEndMutation.mutate();
        }}
        printingCompleted
      />
    );
  }

  if (isBallotReinsertionState(stateMachineState)) {
    return <BallotReinsertionFlow stateMachineState={stateMachineState} />;
  }

  return (
    <BallotContext.Provider
      value={{
        ...rest,
        generateBallotId: randomBallotId,
        isCardlessVoter: true,
        resetBallot,
      }}
    >
      <PatDeviceContextProvider isPatDeviceConnected={isPathDeviceConnected}>
        {ballotContextProviderChild}
      </PatDeviceContextProvider>
    </BallotContext.Provider>
  );
}
