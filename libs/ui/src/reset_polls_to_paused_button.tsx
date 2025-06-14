import { assert } from '@vx/libs/basics/assert';
import React, { useState } from 'react';
import { Button } from '../buttons/button';
import { Modal } from '../modal/modal';
import { Prose } from '../primitives/prose';
import { H1, P } from '../primitives/typography';

interface Props {
  resetPollsToPausedText: string;
  resetPollsToPaused?: () => Promise<void>;
}

export function ResetPollsToPausedButton({
  resetPollsToPausedText,
  resetPollsToPaused,
}: Props): JSX.Element {
  const [isShowingConfirmModal, setIsShowingConfirmModal] = useState(false);

  function showModal() {
    setIsShowingConfirmModal(true);
  }

  function hideModal() {
    setIsShowingConfirmModal(false);
  }

  async function doReset() {
    assert(resetPollsToPaused);
    await resetPollsToPaused();
    hideModal();
  }

  return (
    <React.Fragment>
      <Button onPress={showModal} disabled={!resetPollsToPaused}>
        Reset Polls to Paused
      </Button>
      {isShowingConfirmModal && (
        <Modal
          content={
            <Prose>
              <H1>Reset Polls to Paused</H1>
              <P>{resetPollsToPausedText}</P>
            </Prose>
          }
          onOverlayClick={hideModal}
          actions={
            <React.Fragment>
              <Button variant="danger" onPress={doReset}>
                Reset Polls to Paused
              </Button>
              <Button onPress={hideModal}>Close</Button>
            </React.Fragment>
          }
        />
      )}
    </React.Fragment>
  );
}
