import {
  H2,
  P,
  Icons,
  UnconfigureMachineButton,
  RebootToBiosButton,
  CurrentDateAndTime,
  SetClockButton,
  ExportLogsButton,
  SignedHashValidationButton,
} from '@vx/libs/ui/src';
import { useContext } from 'react';
import { NavigationScreen } from '../navigation_screen';
import { AppContext } from '../contexts/app_context';
import { logOut, unconfigure, useApiClient } from '../api';

export function SystemAdministratorSettingsScreen(): JSX.Element {
  const { electionDefinition, usbDriveStatus } = useContext(AppContext);
  const apiClient = useApiClient();
  const unconfigureMutation = unconfigure.useMutation();
  const logOutMutation = logOut.useMutation();

  return (
    <NavigationScreen title="Settings">
      <H2>Election</H2>
      <P>
        <Icons.Info /> To adjust settings for the current election, please
        insert an election manager card.
      </P>
      <UnconfigureMachineButton
        unconfigureMachine={async () => {
          try {
            await unconfigureMutation.mutateAsync({
              ignoreBackupRequirement: true,
            });
          } catch {
            // Handled by default query client error handling
          }
        }}
        isMachineConfigured={Boolean(electionDefinition)}
      />
      <H2>Logs</H2>
      <ExportLogsButton usbDriveStatus={usbDriveStatus} />
      <H2>Date and Time</H2>
      <P>
        <CurrentDateAndTime />
      </P>
      <SetClockButton logOut={() => logOutMutation.mutate()}>
        Set Date and Time
      </SetClockButton>
      <H2>Software Update</H2>
      <RebootToBiosButton />
      <H2>Security</H2>
      <SignedHashValidationButton apiClient={apiClient} />
    </NavigationScreen>
  );
}
