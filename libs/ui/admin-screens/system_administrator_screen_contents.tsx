import React from 'react';
import { isVxDev } from '@vx/libs/utils/src';

import styled from 'styled-components';
import { type UsbDriveStatus } from '@vx/libs/usb-drive/src';
import { Button } from '../buttons/button';
import { RebootToBiosButton } from '../system-controls/reboot_to_bios_button';
import { UnconfigureMachineButton } from '../auth-screens/unconfigure_machine_button';
import { ResetPollsToPausedButton } from '../src/reset_polls_to_paused_button';
import { P } from '../primitives/typography';
import { SetClockButton } from '../clock/set_clock';
import { ExportLogsButton } from '../logs-exports/export_logs_modal';

interface Props {
  displayRemoveCardToLeavePrompt?: boolean;
  primaryText: React.ReactNode;
  unconfigureMachine: () => Promise<void>;
  resetPollsToPausedText?: string;
  resetPollsToPaused?: () => Promise<void>;
  isMachineConfigured: boolean;
  logOut: () => void;
  usbDriveStatus: UsbDriveStatus;
  additionalButtons?: React.ReactNode;
}

const ButtonGrid = styled.div`
  display: grid;
  grid-auto-rows: 1fr;
  grid-gap: max(${(p) => p.theme.sizes.minTouchAreaSeparationPx}px, 0.25rem);
  grid-template-columns: 1fr 1fr;

  @media (orientation: landscape) {
    grid-template-columns: 1fr 1fr 1fr;
  }

  button {
    flex-wrap: nowrap;
    white-space: nowrap;
  }
`;

/**
 * A component for system administrator (formerly super admin) screen contents on non-VxAdmin
 * machines
 */
export function SystemAdministratorScreenContents({
  displayRemoveCardToLeavePrompt,
  primaryText,
  unconfigureMachine,
  resetPollsToPausedText,
  resetPollsToPaused,
  isMachineConfigured,
  logOut,
  additionalButtons,
  usbDriveStatus,
}: Props): JSX.Element {
  return (
    <React.Fragment>
      <P>{primaryText}</P>
      {displayRemoveCardToLeavePrompt && (
        <P>Remove the System Administrator card to leave this screen.</P>
      )}
      <ButtonGrid>
        {resetPollsToPausedText && (
          <ResetPollsToPausedButton
            resetPollsToPausedText={resetPollsToPausedText}
            resetPollsToPaused={resetPollsToPaused}
          />
        )}
        <SetClockButton logOut={logOut}>Set Date and Time</SetClockButton>
        <RebootToBiosButton />
        <UnconfigureMachineButton
          unconfigureMachine={unconfigureMachine}
          isMachineConfigured={isMachineConfigured}
        />
        <ExportLogsButton usbDriveStatus={usbDriveStatus} />
        {additionalButtons}
        {isVxDev() && (
          <Button onPress={() => window.kiosk?.quit()}>Quit</Button>
        )}
      </ButtonGrid>
    </React.Fragment>
  );
}
