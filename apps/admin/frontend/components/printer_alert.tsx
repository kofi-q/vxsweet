import React, { useEffect, useState } from 'react';
import { type PrinterRichStatus } from '@vx/libs/types/printing';
import { Button } from '@vx/libs/ui/buttons';
import { Icons, P } from '@vx/libs/ui/primitives';
import { Modal } from '@vx/libs/ui/modal';
import {
  IPP_PRINTER_STATE_REASON_MESSAGES,
  parseHighestPriorityIppPrinterStateReason,
} from '@vx/libs/ui/diagnostics';
import { isElectionManagerAuth } from '@vx/libs/utils/src';
import { getAuthStatus, getPrinterStatus } from '../api/api';

export function PrinterAlert(): JSX.Element | null {
  const printerStatusQuery = getPrinterStatus.useQuery();
  const authStatusQuery = getAuthStatus.useQuery();
  const [alertStatus, setAlertStatus] = useState<PrinterRichStatus>();

  const printerStatus = printerStatusQuery.data;
  useEffect(() => {
    if (
      printerStatus &&
      printerStatus.connected === true &&
      printerStatus.richStatus &&
      printerStatus.richStatus.state === 'stopped'
    ) {
      setAlertStatus(printerStatus.richStatus);
    } else {
      setAlertStatus(undefined);
    }
  }, [printerStatus]);

  // We only show alerts to election managers. We don't need to show alerts
  // when not logged in and we don't want to show alerts to system
  // administrators because they already see the same information on the
  // diagnostics page.
  if (
    !authStatusQuery.isSuccess ||
    !isElectionManagerAuth(authStatusQuery.data)
  ) {
    return null;
  }

  if (!alertStatus) {
    return null;
  }

  const stoppedReason = parseHighestPriorityIppPrinterStateReason(
    alertStatus.stateReasons
  );

  // There can be 'other-error' blips without a specific message, so it's not
  // worth showing.
  if (!stoppedReason || stoppedReason === 'other') {
    return null;
  }

  return (
    <Modal
      title={
        <React.Fragment>
          <Icons.Warning color="warning" /> Printer Alert
        </React.Fragment>
      }
      content={<P>{IPP_PRINTER_STATE_REASON_MESSAGES[stoppedReason]}</P>}
      actions={
        <Button onPress={() => setAlertStatus(undefined)}>Dismiss</Button>
      }
    />
  );
}
