import { type ElectionDefinition } from '@vx/libs/types/elections';
import { Button, SegmentedButton } from '@vx/libs/ui/buttons';
import { Modal } from '@vx/libs/ui/modal';
import { SetClockButton } from '@vx/libs/ui/clock';
import { ChangePrecinctButton } from '@vx/libs/ui/src';
import { PowerDownButton } from '@vx/libs/ui/system-controls';
import { UnconfigureMachineButton } from '@vx/libs/ui/auth-screens/unconfigure_machine_button';
import { SignedHashValidationButton } from '@vx/libs/ui/ballots';
import { ExportLogsButton } from '@vx/libs/ui/logs-exports';
import { P, Icons } from '@vx/libs/ui/primitives';
import { TabbedSection, type TabConfig } from '@vx/libs/ui/tabbed_section';
import React, { useState } from 'react';
import { type PrecinctScannerStatus } from '../../../backend/types/types';
import { type UsbDriveStatus } from '@vx/libs/usb-drive/src';
import styled from 'styled-components';
import { ExportResultsModal } from '../../components/exports/export_results_modal';
import { Screen } from '../../components/layout/layout';
import {
  ejectUsbDrive,
  getAuthStatus,
  getConfig,
  getMachineConfig,
  getPollsInfo,
  getPrinterStatus,
  getUsbDriveStatus,
  logOut,
  setIsContinuousExportEnabled,
  setIsSoundMuted,
  setIsDoubleFeedDetectionDisabled,
  setPrecinctSelection,
  setTestMode,
  unconfigureElection,
  beginDoubleFeedCalibration,
  useApiClient,
} from '../../api/api';
import { usePreviewContext } from '../../preview-helpers/helpers';
import { ElectionManagerPrinterTabContent } from '../../components/printer_management/election_manager_printer_tab_content';
import { DiagnosticsScreen } from '../diagnostics/screen';

const TabPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: start;
`;

export interface ElectionManagerScreenProps {
  // We pass electionDefinition in as a prop because the preview dashboard needs
  // to be able to change it (otherwise we would just use the configQuery
  electionDefinition: ElectionDefinition;
  scannerStatus: PrecinctScannerStatus;
  usbDrive: UsbDriveStatus;
}

export function ElectionManagerScreen({
  electionDefinition,
  scannerStatus,
  usbDrive,
}: ElectionManagerScreenProps): JSX.Element | null {
  const apiClient = useApiClient();
  const configQuery = getConfig.useQuery();
  const pollsInfoQuery = getPollsInfo.useQuery();
  const usbDriveStatusQuery = getUsbDriveStatus.useQuery();
  const authStatusQuery = getAuthStatus.useQuery();
  const printerStatusQuery = getPrinterStatus.useQuery();
  const machineConfigQuery = getMachineConfig.useQuery();
  const setPrecinctSelectionMutation = setPrecinctSelection.useMutation();
  const setTestModeMutation = setTestMode.useMutation();
  const setIsSoundMutedMutation = setIsSoundMuted.useMutation();
  const setIsDoubleFeedDetectionDisabledMutation =
    setIsDoubleFeedDetectionDisabled.useMutation();
  const beginDoubleFeedCalibrationMutation =
    beginDoubleFeedCalibration.useMutation();
  const unconfigureMutation = unconfigureElection.useMutation();
  const ejectUsbDriveMutation = ejectUsbDrive.useMutation();
  const logOutMutation = logOut.useMutation();
  const setIsContinuousExportEnabledMutation =
    setIsContinuousExportEnabled.useMutation();

  const [isConfirmingSwitchToTestMode, setIsConfirmingSwitchToTestMode] =
    useState(false);
  const [isDiagnosticsScreenOpen, setIsDiagnosticsScreenOpen] = useState(false);

  const [isExportingResults, setIsExportingResults] = useState(false);

  if (
    !configQuery.isSuccess ||
    !usbDriveStatusQuery.isSuccess ||
    !authStatusQuery.isSuccess ||
    !machineConfigQuery.isSuccess ||
    !pollsInfoQuery.isSuccess ||
    !printerStatusQuery.isSuccess
  ) {
    return null;
  }

  const { election } = electionDefinition;
  const {
    precinctSelection,
    isTestMode,
    isSoundMuted,
    isDoubleFeedDetectionDisabled,
    isContinuousExportEnabled,
  } = configQuery.data;
  const { pollsState } = pollsInfoQuery.data;
  const printerStatus = printerStatusQuery.data;

  const disableConfiguration =
    scannerStatus.state === 'disconnected' ||
    (printerStatus.scheme === 'hardware-v4' && printerStatus.state === 'error');

  const isCvrSyncRequired =
    Boolean(usbDriveStatusQuery.data.doesUsbDriveRequireCastVoteRecordSync) &&
    !isTestMode;

  function switchMode() {
    setTestModeMutation.mutate(
      { isTestMode: !isTestMode },
      {
        onSuccess() {
          setIsConfirmingSwitchToTestMode(false);
        },
      }
    );
  }

  async function unconfigureMachine() {
    try {
      // If there is a mounted usb, eject it so that it doesn't auto reconfigure the machine.
      // TODO move this to the backend?
      await ejectUsbDriveMutation.mutateAsync();
      await unconfigureMutation.mutateAsync();
    } catch {
      // Handled by default query client error handling
    }
  }

  const changePrecinctButton = election.precincts.length > 1 && (
    <ChangePrecinctButton
      appPrecinctSelection={precinctSelection}
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
        pollsState === 'polls_closed_initial'
          ? 'default'
          : pollsState !== 'polls_closed_final' &&
            scannerStatus.ballotsCounted === 0
          ? 'confirmation_required'
          : 'disabled'
      }
    />
  );

  const ballotMode = (
    <SegmentedButton
      disabled={
        setTestModeMutation.isLoading ||
        isCvrSyncRequired ||
        disableConfiguration
      }
      label="Ballot Mode:"
      hideLabel
      onChange={() => {
        if (!isTestMode && scannerStatus.ballotsCounted > 0) {
          setIsConfirmingSwitchToTestMode(true);
          return;
        }
        switchMode();
      }}
      options={[
        { id: 'test', label: 'Test Ballot Mode' },
        { id: 'official', label: 'Official Ballot Mode' },
      ]}
      selectedOptionId={isTestMode ? 'test' : 'official'}
    />
  );

  const dateTimeButton = (
    <SetClockButton logOut={() => logOutMutation.mutate()}>
      Set Date and Time
    </SetClockButton>
  );

  const dataExportButtons = (
    <React.Fragment>
      <Button onPress={() => setIsExportingResults(true)}>Save CVRs</Button>{' '}
      <Button
        onPress={() =>
          setIsContinuousExportEnabledMutation.mutate({
            isContinuousExportEnabled: !isContinuousExportEnabled,
          })
        }
      >
        {isContinuousExportEnabled ? 'Pause' : 'Resume'} Continuous CVR Export
      </Button>{' '}
      <ExportLogsButton usbDriveStatus={usbDrive} />
    </React.Fragment>
  );

  const doubleSheetDetectionToggle = (
    <Button
      onPress={() =>
        setIsDoubleFeedDetectionDisabledMutation.mutate({
          isDoubleFeedDetectionDisabled: !isDoubleFeedDetectionDisabled,
        })
      }
    >
      {isDoubleFeedDetectionDisabled
        ? 'Enable Double Sheet Detection'
        : 'Disable Double Sheet Detection'}
    </Button>
  );

  const calibrateDoubleSheetDetectionButton = (
    <Button
      disabled={scannerStatus.state === 'disconnected'}
      onPress={() => beginDoubleFeedCalibrationMutation.mutate()}
    >
      Calibrate Double Sheet Detection
    </Button>
  );

  const audioMuteToggle = (
    <Button
      onPress={() =>
        setIsSoundMutedMutation.mutate({
          isSoundMuted: !isSoundMuted,
        })
      }
    >
      {isSoundMuted ? 'Unmute Sounds' : 'Mute Sounds'}
    </Button>
  );

  const unconfigureElectionButton = (
    <UnconfigureMachineButton
      // TODO rename isMachineConfigured -> disabled to be clearer
      isMachineConfigured={!isCvrSyncRequired}
      unconfigureMachine={unconfigureMachine}
    />
  );

  const diagnosticsButton =
    printerStatus.scheme === 'hardware-v4' ? (
      <Button onPress={() => setIsDiagnosticsScreenOpen(true)}>
        Diagnostics
      </Button>
    ) : null;

  const powerDownButton = <PowerDownButton />;

  const cvrSyncRequiredWarning = isCvrSyncRequired ? (
    <div>
      <Icons.Warning color="warning" /> Cast vote records (CVRs) need to be
      synced to the inserted USB drive before you can modify the machine
      configuration. Remove your election manager card to sync.
    </div>
  ) : null;

  const tabs: TabConfig[] = [
    {
      paneId: 'managerSettingsConfiguration',
      label: 'Configuration',
      content: (
        <TabPanel>
          {cvrSyncRequiredWarning}
          {changePrecinctButton}
          {ballotMode}
          {unconfigureElectionButton}
        </TabPanel>
      ),
    },
  ];

  if (printerStatus.scheme === 'hardware-v4') {
    const showWarningIcon = printerStatus.state !== 'idle';

    tabs.push({
      paneId: 'managerSettingsPrinter',
      label: 'Printer',
      icon: showWarningIcon ? 'Warning' : undefined,
      content: <ElectionManagerPrinterTabContent />,
    });
  }

  tabs.push(
    {
      paneId: 'managerSettingsData',
      label: 'CVRs and Logs',
      content: <TabPanel>{dataExportButtons}</TabPanel>,
    },
    {
      paneId: 'managerSettingsSystem',
      label: 'System Settings',
      content: (
        <TabPanel>
          {calibrateDoubleSheetDetectionButton}
          {doubleSheetDetectionToggle}
          {dateTimeButton}
          {audioMuteToggle}
          <SignedHashValidationButton apiClient={apiClient} />
          {diagnosticsButton}
          {powerDownButton}
        </TabPanel>
      ),
    }
  );

  if (isDiagnosticsScreenOpen) {
    return (
      <DiagnosticsScreen onClose={() => setIsDiagnosticsScreenOpen(false)} />
    );
  }

  return (
    <Screen
      infoBarMode="admin"
      ballotCountOverride={scannerStatus.ballotsCounted}
      title="Election Manager Settings"
      voterFacing={false}
    >
      <TabbedSection ariaLabel="Election Manager Settings" tabs={tabs} />

      {isConfirmingSwitchToTestMode &&
        (() => {
          return (
            <Modal
              title="Switch to Test Mode?"
              content={
                <P>
                  Do you want to switch to test mode and clear the ballots
                  scanned at this scanner?
                </P>
              }
              actions={
                <React.Fragment>
                  <Button onPress={switchMode} variant="danger" icon="Danger">
                    Yes, Switch
                  </Button>
                  <Button
                    onPress={() => setIsConfirmingSwitchToTestMode(false)}
                  >
                    Cancel
                  </Button>
                </React.Fragment>
              }
              onOverlayClick={() => setIsConfirmingSwitchToTestMode(false)}
            />
          );
        })()}

      {isExportingResults && (
        <ExportResultsModal
          onClose={() => setIsExportingResults(false)}
          usbDrive={usbDrive}
        />
      )}
    </Screen>
  );
}

/* istanbul ignore next */
export function DefaultPreview(): JSX.Element {
  const { electionDefinition } = usePreviewContext();
  return (
    <ElectionManagerScreen
      electionDefinition={electionDefinition}
      scannerStatus={{
        state: 'no_paper',
        ballotsCounted: 1234,
      }}
      usbDrive={{ status: 'no_drive' }}
    />
  );
}
