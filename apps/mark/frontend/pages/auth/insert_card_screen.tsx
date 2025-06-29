import React from 'react';
import {
  type ElectionDefinition,
  type PrecinctSelection,
  type PollsState,
} from '@vx/libs/types/elections';
import { Main, Screen } from '@vx/libs/ui/screens';
import { TestMode } from '@vx/libs/ui/test-mode';
import { InsertCardImage } from '@vx/libs/ui/auth-screens';
import { ElectionInfoBar } from '@vx/libs/ui/election-info';
import { Prose, H1, P, Caption, Icons, Font } from '@vx/libs/ui/primitives';

import { throwIllegalValue } from '@vx/libs/basics/assert';

interface Props {
  appPrecinct: PrecinctSelection;
  electionDefinition: ElectionDefinition;
  electionPackageHash: string;
  showNoChargerAttachedWarning: boolean;
  isLiveMode: boolean;
  pollsState: PollsState;
  showNoAccessibleControllerWarning: boolean;
}

export function InsertCardScreen({
  appPrecinct,
  electionDefinition,
  electionPackageHash,
  showNoChargerAttachedWarning,
  isLiveMode,
  pollsState,
  showNoAccessibleControllerWarning,
}: Props): JSX.Element {
  const mainText = (() => {
    switch (pollsState) {
      case 'polls_closed_initial':
        return (
          <React.Fragment>
            <H1>Polls Closed</H1>
            <P>Insert poll worker card to open.</P>
          </React.Fragment>
        );
      case 'polls_open':
        return <H1>Insert Card</H1>;
      case 'polls_paused':
        return (
          <React.Fragment>
            <H1>Voting Paused</H1>
            <P>Insert poll worker card to resume voting.</P>
          </React.Fragment>
        );
      case 'polls_closed_final':
        return (
          <React.Fragment>
            <H1>Polls Closed</H1>
            <P>Voting is complete.</P>
          </React.Fragment>
        );
      /* istanbul ignore next - compile time check for completeness */
      default:
        throwIllegalValue(pollsState);
    }
  })();

  return (
    <Screen>
      {!isLiveMode && <TestMode />}
      <Main centerChild>
        <Prose textCenter>
          {showNoChargerAttachedWarning && (
            <Caption>
              <Icons.Warning color="warning" />{' '}
              <Font weight="bold">No Power Detected.</Font> Please ask a poll
              worker to plug in the power cord for this machine.
            </Caption>
          )}
          <P>
            <InsertCardImage />
          </P>
          {mainText}
          {showNoAccessibleControllerWarning && (
            <Caption>
              Voting with an accessible controller is not currently available.
            </Caption>
          )}
        </Prose>
      </Main>
      <ElectionInfoBar
        electionDefinition={electionDefinition}
        electionPackageHash={electionPackageHash}
        precinctSelection={appPrecinct}
      />
    </Screen>
  );
}
