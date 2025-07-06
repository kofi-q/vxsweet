import React from 'react';
import { Modal } from '@vx/libs/ui/modal';
import { P } from '@vx/libs/ui/primitives';
import { Button } from '@vx/libs/ui/buttons';
import {
  clearCastVoteRecordFiles,
  deleteAllManualResults,
} from '../../api/api';

export function ConfirmRemoveAllResultsModal({
  onClose,
}: {
  onClose: VoidFunction;
}): JSX.Element {
  const clearCastVoteRecordFilesMutation =
    clearCastVoteRecordFiles.useMutation();
  const deleteAllManualTalliesMutation = deleteAllManualResults.useMutation();

  async function removeAllResults() {
    await Promise.all([
      clearCastVoteRecordFilesMutation.mutateAsync(),
      deleteAllManualTalliesMutation.mutateAsync(),
    ]);
    onClose();
  }

  const isAnyMutationLoading =
    clearCastVoteRecordFilesMutation.isPending ||
    deleteAllManualTalliesMutation.isPending;

  return (
    <Modal
      title="Remove All Tallies"
      content={
        <P>Tallies will be removed from reports and permanently deleted.</P>
      }
      actions={
        <React.Fragment>
          <Button
            onPress={removeAllResults}
            icon="Delete"
            color="danger"
            disabled={isAnyMutationLoading}
          >
            Remove All Tallies
          </Button>
          <Button onPress={onClose} disabled={isAnyMutationLoading}>
            Cancel
          </Button>
        </React.Fragment>
      }
      onOverlayClick={onClose}
    />
  );
}
