import React, { useEffect, useState } from 'react';
import { format } from '@vx/libs/utils/src';
import { type Optional } from '@vx/libs/basics/types';
import { iter } from '@vx/libs/basics/iterators';
import { Modal } from '../modal/modal';
import { useSystemCallApi } from '../system-calls/system_call_api';
import { Button } from '../buttons/button';
import { P } from '../primitives/typography';
import { Icons } from '../primitives/icons';

const WARNING_THRESHOLDS: number[] = [0.05, 0.1];

function getApplicableThreshold(level: number): Optional<number> {
  return iter(WARNING_THRESHOLDS)
    .filter((threshold) => level <= threshold)
    .min();
}

/**
 * Modal that displays a warning when the battery is low.
 */
export function BatteryLowAlert(): JSX.Element | null {
  const systemCallApi = useSystemCallApi();
  const batteryInfoQuery = systemCallApi.getBatteryInfo.useQuery();
  const batteryInfo = batteryInfoQuery.data;

  const [displayedWarning, setDisplayedWarning] = useState<number>();

  const applicableThreshold = batteryInfo
    ? getApplicableThreshold(batteryInfo.level)
    : undefined;
  const discharging = batteryInfo ? batteryInfo.discharging : false;
  useEffect(() => {
    if (discharging && applicableThreshold) {
      setDisplayedWarning(applicableThreshold);
    } else {
      setDisplayedWarning(undefined);
    }
  }, [applicableThreshold, discharging]);

  if (!batteryInfo) {
    return null;
  }

  if (!displayedWarning) {
    return null;
  }

  return (
    <Modal
      title={
        <React.Fragment>
          <Icons.BatteryQuarter color="danger" /> Low Battery Warning
        </React.Fragment>
      }
      actions={
        <Button onPress={() => setDisplayedWarning(undefined)}>Dismiss</Button>
      }
      content={
        <P>
          The battery is at {format.percent(batteryInfo.level)} and is not
          charging. Please connect the power supply.
        </P>
      }
    />
  );
}
