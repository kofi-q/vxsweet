import { useState } from 'react';
import { Button } from '../buttons/button';
import { Loading } from '../primitives/loading';
import { Modal } from '../modal/modal';
import { useSystemCallApi } from '../system-calls/system_call_api';

/**
 * Button that reboots into the BIOS setup.
 */
export function RebootToBiosButton(): JSX.Element {
  const [isRebooting, setIsRebooting] = useState(false);

  const api = useSystemCallApi();
  const rebootToBiosMutation = api.rebootToBios.useMutation();

  function reboot() {
    setIsRebooting(true);
    rebootToBiosMutation.mutate();
  }

  if (isRebooting) {
    return <Modal content={<Loading>Rebooting</Loading>} />;
  }
  return <Button onPress={reboot}>Reboot to BIOS</Button>;
}
