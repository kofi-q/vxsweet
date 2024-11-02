import React from 'react';
import { Modal } from '@vx/libs/ui/modal';
import { Button } from '@vx/libs/ui/buttons';
import { P } from '@vx/libs/ui/primitives';
import { deleteAllManualResults } from '../../api/api';

export function ConfirmRemoveAllManualTalliesModal({
  onClose,
}: {
  onClose: VoidFunction;
}): JSX.Element {
  const deleteAllManualTalliesMutation = deleteAllManualResults.useMutation();

  function onConfirm() {
    deleteAllManualTalliesMutation.mutate(undefined, { onSuccess: onClose });
  }

  return (
    <Modal
      title="Remove All Manual Tallies?"
      content={<P>Do you want to remove all manual tallies?</P>}
      actions={
        <React.Fragment>
          <Button
            icon="Delete"
            variant="danger"
            onPress={onConfirm}
            disabled={deleteAllManualTalliesMutation.isLoading}
          >
            Remove All Manual Tallies
          </Button>
          <Button
            onPress={onClose}
            disabled={deleteAllManualTalliesMutation.isLoading}
          >
            Cancel
          </Button>
        </React.Fragment>
      }
      onOverlayClick={onClose}
    />
  );
}
