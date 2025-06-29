import { Button } from '@vx/libs/ui/buttons';
import { Icons, P } from '@vx/libs/ui/primitives';
import { Modal } from '@vx/libs/ui/modal';
import React from 'react';
import * as api from '../api/api';

export interface Props {
  batchId: string;
  batchLabel: string;
  onClose: () => void;
}

/**
 * Provides a modal for confirming the deletion of a scanned ballot batch.
 */
export function DeleteBatchModal({
  batchId,
  batchLabel,
  onClose,
}: Props): JSX.Element {
  const deleteBatchMutation = api.deleteBatch.useMutation();

  function doDeleteBatch() {
    deleteBatchMutation.mutate({ batchId }, { onSuccess: onClose });
  }

  return (
    <Modal
      onOverlayClick={onClose}
      title={`Delete ‘${batchLabel}’?`}
      content={
        <React.Fragment>
          <P>This action cannot be undone.</P>
          {deleteBatchMutation.error ? (
            <P>
              <Icons.Danger color="danger" /> {`${deleteBatchMutation.error}`}
            </P>
          ) : null}
        </React.Fragment>
      }
      actions={
        <React.Fragment>
          <Button
            icon="Delete"
            variant="danger"
            onPress={doDeleteBatch}
            disabled={!deleteBatchMutation.isIdle}
            autoFocus
          >
            {deleteBatchMutation.isLoading ? 'Deleting…' : 'Yes, Delete Batch'}
          </Button>
          <Button onPress={onClose} disabled={!deleteBatchMutation.isIdle}>
            Cancel
          </Button>
        </React.Fragment>
      }
    />
  );
}
