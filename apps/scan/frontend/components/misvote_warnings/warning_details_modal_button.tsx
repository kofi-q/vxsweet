import { Button } from '@vx/libs/ui/buttons';
import { Modal, ModalWidth } from '@vx/libs/ui/modal';
import { WithScrollButtons } from '@vx/libs/ui/touch-controls';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import React from 'react';
import { type MisvoteWarningsProps } from './types';
import { WarningDetails } from './warning_details';

export function WarningDetailsModalButton(
  props: MisvoteWarningsProps
): JSX.Element {
  const { blankContests, overvoteContests, partiallyVotedContests } = props;
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  if (isModalOpen) {
    return (
      <Modal
        modalWidth={ModalWidth.Wide}
        content={
          <WithScrollButtons>
            <WarningDetails
              blankContests={blankContests}
              overvoteContests={overvoteContests}
              partiallyVotedContests={partiallyVotedContests}
            />
          </WithScrollButtons>
        }
        actions={
          <Button onPress={setIsModalOpen} value={false} variant="primary">
            {appStrings.buttonClose()}
          </Button>
        }
        onOverlayClick={() => setIsModalOpen(false)}
      />
    );
  }

  return (
    <Button onPress={setIsModalOpen} value>
      {appStrings.buttonViewContests()}
    </Button>
  );
}
