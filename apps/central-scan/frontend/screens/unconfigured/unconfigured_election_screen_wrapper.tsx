import { UnconfiguredElectionScreen } from '@vx/libs/ui/auth-screens';
import { useQueryChangeListener } from '@vx/libs/ui/hooks/use_change_listener';
import { assert } from '@vx/libs/basics/assert';
import {
  configureFromElectionPackageOnUsbDrive,
  getUsbDriveStatus,
} from '../../api/api';
import { NavigationScreen } from '../nav/navigation_screen';

interface Props {
  isElectionManagerAuth: boolean;
}

export function UnconfiguredElectionScreenWrapper({
  isElectionManagerAuth,
}: Props): JSX.Element {
  const usbDriveStatusQuery = getUsbDriveStatus.useQuery();
  // USB drive status is guaranteed to exist because app root will not render
  // this component until the USB drive query succeeds.
  assert(usbDriveStatusQuery.isSuccess);

  const configureMutation =
    configureFromElectionPackageOnUsbDrive.useMutation();

  useQueryChangeListener(usbDriveStatusQuery, {
    onChange: (newUsbDriveStatus) => {
      if (newUsbDriveStatus.status === 'mounted') {
        configureMutation.mutate();
      }
    },
  });

  const error = configureMutation.data?.err();

  return (
    <NavigationScreen>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        <UnconfiguredElectionScreen
          usbDriveStatus={usbDriveStatusQuery.data}
          isElectionManagerAuth={isElectionManagerAuth}
          backendConfigError={error}
          machineName="VxCentralScan"
        />
      </div>
    </NavigationScreen>
  );
}
