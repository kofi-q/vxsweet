import { useState } from 'react';
import { Button, type ButtonProps } from '../buttons/button';
import { Loading } from '../primitives/loading';
import { Modal } from '../modal/modal';
import { useSystemCallApi } from '../system-calls/system_call_api';

export type PowerDownButtonProps = Omit<ButtonProps, 'onPress'>;

/**
 * Button that powers down the machine.
 */
export function PowerDownButton(props: PowerDownButtonProps): JSX.Element {
  const [isPoweringDown, setIsPoweringDown] = useState(false);
  const api = useSystemCallApi();
  const powerDownMutation = api.powerDown.useMutation();

  function reboot() {
    setIsPoweringDown(true);
    powerDownMutation.mutate();
  }

  if (isPoweringDown) {
    return <Modal content={<Loading>Powering Down</Loading>} />;
  }
  return (
    <Button {...props} onPress={reboot}>
      Power Down
    </Button>
  );
}
