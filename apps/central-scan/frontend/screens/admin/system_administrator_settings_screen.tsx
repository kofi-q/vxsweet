import { H2, P, Icons } from '@vx/libs/ui/primitives';
import { UnconfigureMachineButton } from '@vx/libs/ui/auth-screens/unconfigure_machine_button';
import { RebootToBiosButton } from '@vx/libs/ui/system-controls';
import { CurrentDateAndTime, SetClockButton } from '@vx/libs/ui/clock';
import { SignedHashValidationButton } from '@vx/libs/ui/ballots';
import { ExportLogsButton } from '@vx/libs/ui/logs-exports';
import { useContext } from 'react';
import { NavigationScreen } from '../nav/navigation_screen';
import { AppContext } from '../../contexts/app_context';
import { logOut, unconfigure, useApiClient } from '../../api/api';

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
