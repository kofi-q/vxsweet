import React from 'react';
import { Button } from '@vx/libs/ui/buttons';
import { PowerDownButton } from '@vx/libs/ui/system-controls';
import { SystemAdministratorScreenContents } from '@vx/libs/ui/admin-screens';
import { SignedHashValidationButton } from '@vx/libs/ui/ballots';
import {
  type ElectionDefinition,
  type PollsState,
} from '@vx/libs/types/elections';
import { type UsbDriveStatus } from '@vx/libs/usb-drive/src';
import { Screen } from '../../components/layout/layout';
import {
  unconfigureElection,
  logOut,
  resetPollsToPaused,
  getPrinterStatus,
  useApiClient,
} from '../../api/api';
import { usePreviewContext } from '../../preview-helpers/helpers';
import { DiagnosticsScreen } from '../diagnostics/screen';

interface SystemAdministratorScreenProps {
  electionDefinition?: ElectionDefinition;
  pollsState: PollsState;
  usbDrive: UsbDriveStatus;
}

export function SystemAdministratorScreen({
  electionDefinition,
  pollsState,
  usbDrive,
}: SystemAdministratorScreenProps): JSX.Element {
  const [isDiagnosticsScreenOpen, setIsDiagnosticsScreenOpen] =
    React.useState(false);
  const apiClient = useApiClient();
  const resetPollsToPausedMutation = resetPollsToPaused.useMutation();
  const unconfigureMutation = unconfigureElection.useMutation();
  const logOutMutation = logOut.useMutation();
  const printerStatusQuery = getPrinterStatus.useQuery();

  if (isDiagnosticsScreenOpen) {
    return (
      <DiagnosticsScreen onClose={() => setIsDiagnosticsScreenOpen(false)} />
    );
  }

  return (
    <Screen
      title="System Administrator"
      voterFacing={false}
      padded
      hideBallotCount
    >
      <SystemAdministratorScreenContents
        displayRemoveCardToLeavePrompt
        primaryText={
          <React.Fragment>
            To adjust settings for the current election, insert an election
            manager or poll worker card.
          </React.Fragment>
        }
        unconfigureMachine={() => unconfigureMutation.mutateAsync()}
        resetPollsToPausedText="The polls are closed and voting is complete. After resetting the polls to paused, it will be possible to re-open the polls and resume voting. All current cast vote records will be preserved."
        resetPollsToPaused={
          pollsState === 'polls_closed_final'
            ? () => resetPollsToPausedMutation.mutateAsync()
            : undefined
        }
        isMachineConfigured={Boolean(electionDefinition)}
        logOut={() => logOutMutation.mutate()}
        usbDriveStatus={usbDrive}
        additionalButtons={
          <React.Fragment>
            {printerStatusQuery.data?.scheme === 'hardware-v4' && (
              <Button onPress={() => setIsDiagnosticsScreenOpen(true)}>
                System Diagnostics
              </Button>
            )}
            <SignedHashValidationButton apiClient={apiClient} />
            <PowerDownButton />
          </React.Fragment>
        }
      />
    </Screen>
  );
}

/* istanbul ignore next */
export function DefaultPreview(): JSX.Element {
  const { electionDefinition } = usePreviewContext();
  return (
    <SystemAdministratorScreen
      pollsState="polls_open"
      electionDefinition={electionDefinition}
      usbDrive={{ status: 'no_drive' }}
    />
  );
}
