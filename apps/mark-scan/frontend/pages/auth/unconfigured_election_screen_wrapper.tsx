import { UnconfiguredElectionScreen } from '@vx/libs/ui/auth-screens';
import { Main, Screen } from '@vx/libs/ui/screens';
import { useQueryChangeListener } from '@vx/libs/ui/hooks/use_change_listener';
import { assert } from '@vx/libs/basics/src';
import {
  configureElectionPackageFromUsb,
  getUsbDriveStatus,
} from '../../api/api';

/**
 * UnconfiguredElectionScreenWrapper wraps the shared UnconfiguredElectionScreen component
 * with VxMarkScan-specific logic (primarily calls to the VxMarkScan backend)
 */
export function UnconfiguredElectionScreenWrapper(): JSX.Element {
  const usbDriveStatusQuery = getUsbDriveStatus.useQuery();
  // USB drive status is guaranteed to exist because app root will not render
  // this component until the USB drive query succeeds.
  assert(usbDriveStatusQuery.isSuccess);

  const configure = configureElectionPackageFromUsb.useMutation();

  useQueryChangeListener(usbDriveStatusQuery, {
    onChange: (newUsbDriveStatus) => {
      if (newUsbDriveStatus.status === 'mounted') {
        configure.mutate();
      }
    },
  });

  const backendError = configure.data?.err();
  return (
    <Screen>
      <Main centerChild>
        <UnconfiguredElectionScreen
          usbDriveStatus={usbDriveStatusQuery.data}
          isElectionManagerAuth
          backendConfigError={backendError}
          machineName="VxMark"
        />
      </Main>
    </Screen>
  );
}
