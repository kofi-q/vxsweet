import { Button } from '@vx/libs/ui/buttons';
import { Font, P } from '@vx/libs/ui/primitives';
import { Modal } from '@vx/libs/ui/modal';
import { RadioGroup } from '@vx/libs/ui/radio_group';
import React, { useState } from 'react';
import { assert, assertFalsy } from '@vx/libs/basics/assert';
import { sleep } from '@vx/libs/basics/async';
import { type DiagnosticOutcome } from '@vx/libs/types/diagnostics';
import {
  addDiagnosticRecord,
  getPrinterStatus,
  printTestPage,
} from '../api/api';
import { Loading } from './loading';

/**
 * Normally we want to free up the UI sooner, before the print is actually
 * done, but in this case we want to wait until the print is done or almost
 * done before presenting the verification step.
 */
export const TEST_PAGE_PRINT_DELAY_SECONDS = 7;

type FlowState = 'printing' | 'verification' | 'test-failed';

export function PrintTestPageButton(): JSX.Element {
  const [flowState, setFlowState] = useState<FlowState>();
  const [outcome, setOutcome] = useState<DiagnosticOutcome>();

  const printerStatusQuery = getPrinterStatus.useQuery();
  const printTestPageMutation = printTestPage.useMutation();
  const addDiagnosticRecordMutation = addDiagnosticRecord.useMutation();

  const isPrinterConnected =
    printerStatusQuery.isSuccess && printerStatusQuery.data.connected;

  function resetFlow() {
    setFlowState(undefined);
    setOutcome(undefined);
  }

  async function startFlow() {
    printTestPageMutation.mutate();
    setFlowState('printing');
    await sleep(TEST_PAGE_PRINT_DELAY_SECONDS * 1000);
    setFlowState('verification');
  }

  function verifyPrintOutcome() {
    assert(outcome !== undefined);

    addDiagnosticRecordMutation.mutate({
      type: 'test-print',
      outcome,
    });

    if (outcome === 'fail') {
      setFlowState('test-failed');
    } else {
      resetFlow();
    }
  }

  let modal: JSX.Element | null = null;

  switch (flowState) {
    case 'printing':
      modal = (
        <Modal centerContent content={<Loading>Printing Test Page</Loading>} />
      );
      break;
    case 'verification':
      modal = (
        <Modal
          title="Test Page Printed"
          actions={
            <React.Fragment>
              <Button
                onPress={verifyPrintOutcome}
                disabled={!outcome}
                variant="primary"
              >
                Confirm
              </Button>
              <Button onPress={resetFlow}>Cancel</Button>
            </React.Fragment>
          }
          content={
            <React.Fragment>
              <P>Inspect the test page and select a test outcome:</P>
              <RadioGroup
                label="Test Result"
                hideLabel
                value={outcome}
                options={[
                  {
                    value: 'pass',
                    label: (
                      <span>
                        <Font weight="semiBold">Pass</Font> - printed without
                        print quality issues
                      </span>
                    ),
                  },
                  {
                    value: 'fail',
                    label: (
                      <span>
                        <Font weight="semiBold">Fail</Font> - no print or
                        printed with a print quality issue
                      </span>
                    ),
                  },
                ]}
                onChange={(value) => setOutcome(value)}
              />
            </React.Fragment>
          }
        />
      );
      break;
    case 'test-failed':
      modal = (
        <Modal
          title="Test Print Failed"
          actions={<Button onPress={resetFlow}>Close</Button>}
          content={
            <P>
              Please consult the printer manufacturer&apos;s documentation to
              troubleshoot your specific problem.
            </P>
          }
        />
      );
      break;
    // istanbul ignore next
    default:
      assertFalsy(flowState);
  }

  return (
    <React.Fragment>
      <Button disabled={!isPrinterConnected} onPress={startFlow}>
        Print Test Page
      </Button>
      {modal}
    </React.Fragment>
  );
}
