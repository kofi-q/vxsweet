import React, { useContext, useState } from 'react';
import styled from 'styled-components';
import {
  isElectionManagerAuth,
  isSystemAdministratorAuth,
} from '@vx/libs/utils/src';
import { assert, throwIllegalValue } from '@vx/libs/basics/assert';
import { Button, LoadingButton } from '@vx/libs/ui/buttons';
import { Modal } from '@vx/libs/ui/modal';
import { UsbControllerButton } from '@vx/libs/ui/system-controls';
import { P } from '@vx/libs/ui/primitives';
import { type ExportDataError } from '@vx/libs/backend/exporter';

import { ejectUsbDrive, saveElectionPackageToUsb } from '../api/api';
import { AppContext } from '../contexts/app_context';

const UsbImage = styled.img`
  margin-right: auto;
  margin-left: auto;
  height: 200px;
`;

type SaveState =
  | { state: 'unsaved' }
  | { state: 'saved' }
  | { state: 'error'; error: ExportDataError };

const ErrorMessages: Record<ExportDataError['type'], string> = {
  'file-system-error': 'Error reading from USB',
  'missing-usb-drive': 'No USB drive detected',
  'permission-denied': 'Error reading from USB',
  'relative-file-path': 'Error reading from USB',
};

export function ExportElectionPackageModalButton(): JSX.Element {
  const { electionDefinition, usbDriveStatus, auth } = useContext(AppContext);
  assert(electionDefinition);
  assert(isElectionManagerAuth(auth) || isSystemAdministratorAuth(auth));
  const saveElectionPackageToUsbMutation =
    saveElectionPackageToUsb.useMutation();
  const ejectUsbDriveMutation = ejectUsbDrive.useMutation();

  const [saveState, setSaveState] = useState<SaveState>({ state: 'unsaved' });

  const [isModalOpen, setIsModalOpen] = useState(false);

  function closeModal() {
    if (saveElectionPackageToUsbMutation.isLoading) return;
    setIsModalOpen(false);
    setSaveState({ state: 'unsaved' });
  }

  function saveElectionPackage() {
    saveElectionPackageToUsbMutation.mutate(undefined, {
      onSuccess: (result) => {
        if (result.isErr()) {
          setSaveState({ state: 'error', error: result.err() });
        } else {
          setSaveState({ state: 'saved' });
        }
      },
    });
  }

  let title = '';
  let mainContent: React.ReactNode = null;
  let actions: React.ReactNode = null;

  switch (saveState.state) {
    case 'unsaved':
      switch (usbDriveStatus.status) {
        case 'no_drive':
        case 'ejected':
        case 'error':
          actions = <Button onPress={closeModal}>Cancel</Button>;
          title = 'No USB Drive Detected';
          mainContent = (
            <P>
              <UsbImage src="/assets/usb-drive.svg" alt="Insert USB Image" />
              Please insert a USB drive in order to save the election package.
            </P>
          );
          break;
        case 'mounted': {
          actions = (
            <React.Fragment>
              {saveElectionPackageToUsbMutation.isLoading ? (
                <LoadingButton variant="primary">Saving...</LoadingButton>
              ) : (
                <Button
                  icon="Export"
                  onPress={saveElectionPackage}
                  variant="primary"
                >
                  Save
                </Button>
              )}
              <Button
                onPress={closeModal}
                disabled={saveElectionPackageToUsbMutation.isLoading}
              >
                Cancel
              </Button>
            </React.Fragment>
          );
          title = 'Save Election Package';
          mainContent = (
            <P>
              <UsbImage src="/assets/usb-drive.svg" alt="Insert USB Image" />
              An election package will be saved to the inserted USB drive.
            </P>
          );
          break;
        }

        // istanbul ignore next
        default:
          throwIllegalValue(usbDriveStatus, 'status');
      }
      break;

    case 'saved': {
      if (usbDriveStatus.status !== 'ejected') {
        actions = (
          <React.Fragment>
            <UsbControllerButton
              primary
              usbDriveEject={() => ejectUsbDriveMutation.mutate()}
              usbDriveStatus={usbDriveStatus}
              usbDriveIsEjecting={ejectUsbDriveMutation.isLoading}
            />
            <Button onPress={closeModal}>Close</Button>
          </React.Fragment>
        );
      } else {
        actions = <Button onPress={closeModal}>Close</Button>;
      }
      title = 'Election Package Saved';
      mainContent = (
        <P>
          You may now eject the USB drive. Use the saved election package on the
          USB drive to configure VxSuite components.
        </P>
      );
      break;
    }

    case 'error': {
      actions = <Button onPress={closeModal}>Close</Button>;
      title = 'Failed to Save Election Package';
      mainContent = (
        <P>An error occurred: {ErrorMessages[saveState.error.type]}.</P>
      );
      break;
    }

    // istanbul ignore next
    default:
      throwIllegalValue(saveState);
  }

  return (
    <React.Fragment>
      <Button
        variant="primary"
        icon="Export"
        onPress={() => setIsModalOpen(true)}
      >
        Save Election Package
      </Button>
      {isModalOpen && (
        <Modal
          title={title}
          content={mainContent}
          onOverlayClick={closeModal}
          actions={actions}
        />
      )}
    </React.Fragment>
  );
}
