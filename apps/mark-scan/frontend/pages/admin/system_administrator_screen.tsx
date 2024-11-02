import React, { useState } from 'react';

import { Button } from '@vx/libs/ui/buttons';
import { H3 } from '@vx/libs/ui/primitives';
import { Main, Screen } from '@vx/libs/ui/screens';
import { SignedHashValidationButton } from '@vx/libs/ui/ballots';
import { SystemAdministratorScreenContents } from '@vx/libs/ui/admin-screens';
import { type UsbDriveStatus } from '@vx/libs/usb-drive/src';
import { logOut, useApiClient } from '../../api/api';
import { DiagnosticsScreen } from '../diagnostics/diagnostics_screen';

const resetPollsToPausedText =
  'The polls are closed and voting is complete. After resetting the polls to paused, it will be possible to re-open the polls and resume voting. The printed ballots count will be preserved.';

interface Props {
  unconfigureMachine: () => Promise<void>;
  isMachineConfigured: boolean;
  resetPollsToPaused?: () => Promise<void>;
  usbDriveStatus: UsbDriveStatus;
}

/**
 * Screen when a system administrator card is inserted
 */
export function SystemAdministratorScreen({
  unconfigureMachine,
  isMachineConfigured,
  resetPollsToPaused,
  usbDriveStatus,
}: Props): JSX.Element {
  const apiClient = useApiClient();
  const logOutMutation = logOut.useMutation();
  const [isDiagnosticsScreenOpen, setIsDiagnosticsScreenOpen] = useState(false);

  if (isDiagnosticsScreenOpen) {
    return (
      <DiagnosticsScreen
        onBackButtonPress={() => setIsDiagnosticsScreenOpen(false)}
      />
    );
  }

  return (
    <Screen>
      <Main padded>
        <H3 as="h1">System Administrator</H3>
        <SystemAdministratorScreenContents
          displayRemoveCardToLeavePrompt
          resetPollsToPausedText={resetPollsToPausedText}
          resetPollsToPaused={resetPollsToPaused}
          primaryText={
            <React.Fragment>
              To adjust settings for the current election,
              <br />
              please insert an election manager or poll worker card.
            </React.Fragment>
          }
          unconfigureMachine={unconfigureMachine}
          isMachineConfigured={isMachineConfigured}
          logOut={() => logOutMutation.mutate()}
          usbDriveStatus={usbDriveStatus}
          additionalButtons={
            <React.Fragment>
              <Button onPress={() => setIsDiagnosticsScreenOpen(true)}>
                System Diagnostics
              </Button>
              <SignedHashValidationButton apiClient={apiClient} />
            </React.Fragment>
          }
        />
      </Main>
    </Screen>
  );
}
