import React from 'react';
import { Button } from '@vx/libs/ui/buttons';
import {
  DoubleFeedCalibrationSingleSheetIllustration,
  FullScreenMessage,
} from '@vx/libs/ui/src';
import { Main, MainContent, MainHeader, Screen } from '@vx/libs/ui/screens';
import { FullScreenIconWrapper, H3, Icons, P } from '@vx/libs/ui/primitives';
import { type PrecinctScannerStatus } from '../../../backend/types/types';

function DiagnosticScreen({ children }: { children: React.ReactNode }) {
  return (
    <Screen>
      <Main flexColumn>
        <MainHeader>
          <H3>Scanner Diagnostic</H3>
        </MainHeader>
        <MainContent style={{ display: 'flex', justifyContent: 'center' }}>
          {children}
        </MainContent>
      </Main>
    </Screen>
  );
}

export function ScannerDiagnosticScreen({
  scannerStatus,
  onClose,
}: {
  scannerStatus: PrecinctScannerStatus;
  onClose: VoidFunction;
}): JSX.Element | null {
  switch (scannerStatus.state) {
    case 'scanner_diagnostic.running':
      return (
        <DiagnosticScreen>
          <FullScreenMessage
            title="Insert Blank Sheet"
            image={<DoubleFeedCalibrationSingleSheetIllustration />}
          >
            <P>Insert a blank sheet into the scanner.</P>
          </FullScreenMessage>
        </DiagnosticScreen>
      );

    case 'scanner_diagnostic.done': {
      const closeButton = <Button onPress={onClose}>Close</Button>;
      if (scannerStatus.error) {
        return (
          <DiagnosticScreen>
            <FullScreenMessage
              title="Test Scan Failed"
              image={
                <FullScreenIconWrapper>
                  <Icons.Danger color="danger" />
                </FullScreenIconWrapper>
              }
            >
              <P>
                The test scan was not blank. Make sure you used a blank sheet.
                The scanner may need to be cleaned.
              </P>
              <P>{closeButton}</P>
            </FullScreenMessage>
          </DiagnosticScreen>
        );
      }

      return (
        <DiagnosticScreen>
          <FullScreenMessage
            title="Test Scan Successful"
            image={
              <FullScreenIconWrapper>
                <Icons.Done color="success" />
              </FullScreenIconWrapper>
            }
          >
            <P>{closeButton}</P>
          </FullScreenMessage>
        </DiagnosticScreen>
      );
    }

    /* istanbul ignore next */
    default:
      throw new Error(`Unexpected scanner state: ${scannerStatus.state}`);
  }
}
