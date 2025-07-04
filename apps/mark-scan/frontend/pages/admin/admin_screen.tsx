import React from 'react';

import { P, Caption, Icons, H3, H6 } from '@vx/libs/ui/primitives';
import { ChangePrecinctButton } from '@vx/libs/ui/src';
import { TestMode } from '@vx/libs/ui/test-mode';
import { UsbControllerButton } from '@vx/libs/ui/system-controls';
import { UnconfigureMachineButton } from '@vx/libs/ui/auth-screens/unconfigure_machine_button';
import { CurrentDateAndTime, SetClockButton } from '@vx/libs/ui/clock';
import { SignedHashValidationButton } from '@vx/libs/ui/ballots';
import { SegmentedButton, Button } from '@vx/libs/ui/buttons';
import { ExportLogsButton } from '@vx/libs/ui/logs-exports';
import { ElectionInfoBar } from '@vx/libs/ui/election-info';
import { Main, Screen } from '@vx/libs/ui/screens';
import {
  type ElectionDefinition,
  type PrecinctSelection,
  type PollsState,
} from '@vx/libs/types/elections';
import { type MachineConfig } from '../../../backend/types/types';
import { type UsbDriveStatus } from '@vx/libs/usb-drive/src';
import {
  ejectUsbDrive,
  logOut,
  setPrecinctSelection,
  setTestMode,
  useApiClient,
} from '../../api/api';
import { DiagnosticsScreen } from '../diagnostics/diagnostics_screen';

export interface AdminScreenProps {
  appPrecinct?: PrecinctSelection;
  ballotsPrintedCount: number;
  electionDefinition: ElectionDefinition;
  electionPackageHash: string;
  isTestMode: boolean;
  unconfigure: () => Promise<void>;
  machineConfig: MachineConfig;
  pollsState: PollsState;
  usbDriveStatus: UsbDriveStatus;
}

export function AdminScreen({
  appPrecinct,
  ballotsPrintedCount,
  electionDefinition,
  electionPackageHash,
  isTestMode,
  unconfigure,
  machineConfig,
  pollsState,
  usbDriveStatus,
}: AdminScreenProps): JSX.Element | null {
  const { election } = electionDefinition;
  const apiClient = useApiClient();
  const logOutMutation = logOut.useMutation();
  const ejectUsbDriveMutation = ejectUsbDrive.useMutation();
  const setPrecinctSelectionMutation = setPrecinctSelection.useMutation();
  const setTestModeMutation = setTestMode.useMutation();
  const [isDiagnosticsScreenOpen, setIsDiagnosticsScreenOpen] =
    React.useState(false);

  async function unconfigureMachineAndEjectUsb() {
    try {
      // If there is a mounted usb, eject it so that it doesn't auto reconfigure the machine.
      await ejectUsbDriveMutation.mutateAsync();
      await unconfigure();
    } catch {
      // Handled by default query client error handling
    }
  }

  if (isDiagnosticsScreenOpen) {
    return (
      <DiagnosticsScreen
        onBackButtonPress={() => setIsDiagnosticsScreenOpen(false)}
      />
    );
  }

  return (
    <Screen>
      {election && isTestMode && <TestMode />}
      <Main padded>
        <H3 as="h1">Election Manager Settings</H3>
        <Caption weight="bold">
          <Icons.Info /> Remove card when finished.
        </Caption>
        {election && (
          <React.Fragment>
            <H6 as="h2">Stats</H6>
            <P>
              Ballots Printed: <strong>{ballotsPrintedCount}</strong>
            </P>
            <H6 as="h2">
              <label htmlFor="selectPrecinct">Precinct</label>
            </H6>
            <P>
              <ChangePrecinctButton
                appPrecinctSelection={appPrecinct}
                updatePrecinctSelection={async (newPrecinctSelection) => {
                  try {
                    await setPrecinctSelectionMutation.mutateAsync({
                      precinctSelection: newPrecinctSelection,
                    });
                  } catch {
                    // Handled by default query client error handling
                  }
                }}
                election={election}
                mode={
                  pollsState === 'polls_closed_final' ||
                  election.precincts.length === 1
                    ? 'disabled'
                    : 'default'
                }
              />
              <br />
              <Caption>
                Changing the precinct will reset the Ballots Printed count.
              </Caption>
              {election.precincts.length === 1 && (
                <React.Fragment>
                  <br />
                  <Caption>
                    Precinct cannot be changed because there is only one
                    precinct configured for this election.
                  </Caption>
                </React.Fragment>
              )}
            </P>
            <H6 as="h2">Ballot Mode</H6>
            <P>
              <SegmentedButton
                label="Ballot Mode"
                hideLabel
                onChange={() =>
                  setTestModeMutation.mutate({ isTestMode: !isTestMode })
                }
                options={[
                  { id: 'test', label: 'Test Ballot Mode' },
                  { id: 'official', label: 'Official Ballot Mode' },
                ]}
                selectedOptionId={isTestMode ? 'test' : 'official'}
              />
              <br />
              <Caption>
                Switching the mode will reset the Ballots Printed count.
              </Caption>
            </P>
          </React.Fragment>
        )}
        <H6 as="h2">Date and Time</H6>
        <P>
          <Caption>
            <CurrentDateAndTime />
          </Caption>
        </P>
        <P>
          <SetClockButton logOut={() => logOutMutation.mutate()}>
            Set Date and Time
          </SetClockButton>
        </P>
        <H6 as="h2">Configuration</H6>
        <P>
          <Icons.Checkbox color="success" /> Election Definition is loaded.
        </P>
        <P>
          <UnconfigureMachineButton
            isMachineConfigured
            unconfigureMachine={unconfigureMachineAndEjectUsb}
          />
        </P>
        <H6 as="h2">Logs</H6>
        <P>
          <ExportLogsButton usbDriveStatus={usbDriveStatus} />
        </P>
        <H6 as="h2">USB</H6>
        <P>
          <UsbControllerButton
            primary
            usbDriveStatus={usbDriveStatus}
            usbDriveEject={() => ejectUsbDriveMutation.mutate()}
            usbDriveIsEjecting={ejectUsbDriveMutation.isLoading}
          />
        </P>
        <H6 as="h2">Security</H6>
        <P>
          <SignedHashValidationButton apiClient={apiClient} />
        </P>
        <H6 as="h2">System</H6>
        <P>
          <Button onPress={() => setIsDiagnosticsScreenOpen(true)}>
            Diagnostics
          </Button>
        </P>
      </Main>
      {election && (
        <ElectionInfoBar
          mode="admin"
          electionDefinition={electionDefinition}
          electionPackageHash={electionPackageHash}
          codeVersion={machineConfig.codeVersion}
          machineId={machineConfig.machineId}
          precinctSelection={appPrecinct}
        />
      )}
    </Screen>
  );
}
