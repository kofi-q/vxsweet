import React, { useContext } from 'react';
import { CurrentDateAndTime, SetClockButton } from '@vx/libs/ui/clock';
import { RebootToBiosButton } from '@vx/libs/ui/system-controls';
import { SignedHashValidationButton } from '@vx/libs/ui/ballots';
import { ExportLogsButton } from '@vx/libs/ui/logs-exports';
import { H2, P } from '@vx/libs/ui/primitives';
import { isSystemAdministratorAuth } from '@vx/libs/utils/src';

import { AppContext } from '../contexts/app_context';
import { NavigationScreen } from '../components/navigation_screen';
import { FormatUsbButton } from '../components/format_usb_modal';
import { logOut, useApiClient } from '../api/api';

export function SettingsScreen(): JSX.Element {
  const { auth, usbDriveStatus } = useContext(AppContext);
  const apiClient = useApiClient();
  const logOutMutation = logOut.useMutation();

  return (
    <NavigationScreen title="Settings">
      <H2>Logs</H2>
      <ExportLogsButton usbDriveStatus={usbDriveStatus} />
      <H2>Date and Time</H2>
      <P>
        <CurrentDateAndTime />
      </P>
      <P>
        <SetClockButton logOut={() => logOutMutation.mutate()}>
          Set Date and Time
        </SetClockButton>
      </P>
      {isSystemAdministratorAuth(auth) && (
        <React.Fragment>
          <H2>USB Formatting</H2>
          <FormatUsbButton />
          <H2>Software Update</H2>
          <RebootToBiosButton />
        </React.Fragment>
      )}
      <H2>Security</H2>
      <P>
        <SignedHashValidationButton apiClient={apiClient} />
      </P>
    </NavigationScreen>
  );
}
