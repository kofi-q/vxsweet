import { CenteredLargeProse, H1, P } from '@vx/libs/ui/src';
import React from 'react';
import { ScreenMainCenterChild } from '../../components/layout/layout';
import { useSound } from '../../sound/use_sound';

export function InsertUsbScreen(): JSX.Element {
  const playAlarm = useSound('alarm');
  React.useEffect(() => playAlarm(), [playAlarm]);

  return (
    <ScreenMainCenterChild voterFacing={false}>
      <CenteredLargeProse>
        <H1>No USB Drive Detected</H1>
        <P>Insert USB drive into the USB hub.</P>
      </CenteredLargeProse>
    </ScreenMainCenterChild>
  );
}

/* istanbul ignore next */
export function DefaultPreview(): JSX.Element {
  return <InsertUsbScreen />;
}
