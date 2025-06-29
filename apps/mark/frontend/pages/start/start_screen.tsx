import { StartPage } from '@vx/libs/mark-flow-ui/src';
import React from 'react';
import { useHistory } from 'react-router-dom';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { BallotContext } from '../../contexts/ballot_context';

export function StartScreen(): JSX.Element {
  const history = useHistory();
  const { ballotStyleId, contests, electionDefinition, precinctId } =
    React.useContext(BallotContext);

  function onStart() {
    history.push('/contests/0');
  }

  return (
    <StartPage
      contests={contests}
      onStart={onStart}
      ballotStyleId={ballotStyleId}
      electionDefinition={electionDefinition}
      introAudioText={appStrings.instructionsBmdBallotNavigationMark()}
      precinctId={precinctId}
    />
  );
}
