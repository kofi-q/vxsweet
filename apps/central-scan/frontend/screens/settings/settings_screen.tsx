import { useState, useContext } from 'react';
import { assert } from '@vx/libs/basics/assert';
import { Button } from '@vx/libs/ui/buttons';
import { CurrentDateAndTime, SetClockButton } from '@vx/libs/ui/clock';
import { UnconfigureMachineButton } from '@vx/libs/ui/auth-screens/unconfigure_machine_button';
import { userReadableMessageFromExportError } from '@vx/libs/ui/cvrs';
import { SignedHashValidationButton } from '@vx/libs/ui/ballots';
import { Loading, H2, Icons, P } from '@vx/libs/ui/primitives';
import { ExportLogsButton } from '@vx/libs/ui/logs-exports';
import { Modal } from '@vx/libs/ui/modal';
import { isElectionManagerAuth } from '@vx/libs/utils/src';
import { useHistory } from 'react-router-dom';
import styled from 'styled-components';
import { ToggleTestModeButton } from '../../components/toggle_test_mode_button';
import { AppContext } from '../../contexts/app_context';
import {
  logOut,
  unconfigure,
  exportCastVoteRecordsToUsbDrive,
  ejectUsbDrive,
  useApiClient,
} from '../../api/api';
import { NavigationScreen } from '../nav/navigation_screen';

const ButtonRow = styled.div`
  &:not(:last-child) {
    margin-bottom: 0.5rem;
  }
`;

export interface SettingsScreenProps {
  isTestMode: boolean;
  canUnconfigure: boolean;
}

export function SettingsScreen({
  isTestMode,
  canUnconfigure,
}: SettingsScreenProps): JSX.Element {
  const history = useHistory();
  const { auth, usbDriveStatus } = useContext(AppContext);
  assert(isElectionManagerAuth(auth));
  const apiClient = useApiClient();
  const logOutMutation = logOut.useMutation();
  const unconfigureMutation = unconfigure.useMutation();
  const ejectUsbDriveMutation = ejectUsbDrive.useMutation();
  const exportCastVoteRecordsToUsbDriveMutation =
    exportCastVoteRecordsToUsbDrive.useMutation();

  async function unconfigureMachine() {
    try {
      await ejectUsbDriveMutation.mutateAsync();
      await unconfigureMutation.mutateAsync({ ignoreBackupRequirement: false });
      history.replace('/');
    } catch {
      // Handled by default query client error handling
    }
  }

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupError, setBackupError] = useState('');

  function saveBackup() {
    setIsBackingUp(true);
    setBackupError('');
    exportCastVoteRecordsToUsbDriveMutation.mutate(
      { isMinimalExport: false },
      {
        onSuccess(result) {
          if (result.isErr()) {
            setBackupError(userReadableMessageFromExportError(result.err()));
          }
          setIsBackingUp(false);
        },
      }
    );
  }

  return (
    <NavigationScreen title="Settings">
      <H2>Election</H2>
      <ButtonRow>
        <ToggleTestModeButton
          isTestMode={isTestMode}
          canUnconfigure={canUnconfigure}
        />
      </ButtonRow>
      <ButtonRow>
        <UnconfigureMachineButton
          isMachineConfigured={canUnconfigure}
          unconfigureMachine={unconfigureMachine}
        />
      </ButtonRow>
      {!canUnconfigure && (
        <P>
          <Icons.Warning color="warning" /> You must &quot;Save Backup&quot;
          before you may unconfigure this machine.
        </P>
      )}

      <H2>Backup</H2>
      {backupError && (
        <P>
          <Icons.Danger color="danger" /> {backupError}
        </P>
      )}
      <ButtonRow>
        <Button onPress={saveBackup} disabled={isBackingUp}>
          {isBackingUp ? 'Saving…' : 'Save Backup'}
        </Button>
      </ButtonRow>

      <H2>Logs</H2>
      <ButtonRow>
        <ExportLogsButton usbDriveStatus={usbDriveStatus} />
      </ButtonRow>

      <H2>Date and Time</H2>
      <P>
        <CurrentDateAndTime />
      </P>
      <ButtonRow>
        <SetClockButton logOut={() => logOutMutation.mutate()}>
          Set Date and Time
        </SetClockButton>
      </ButtonRow>

      <H2>Security</H2>
      <ButtonRow>
        <SignedHashValidationButton apiClient={apiClient} />
      </ButtonRow>

      {isBackingUp && (
        <Modal centerContent content={<Loading>Saving backup</Loading>} />
      )}
    </NavigationScreen>
  );
}
