import { throwIllegalValue } from '@vx/libs/basics/assert';
import { Button } from '@vx/libs/ui/buttons';
import { Font, P } from '@vx/libs/ui/primitives';
import { Modal } from '@vx/libs/ui/modal';

export interface DoubleVoteAlert {
  type:
    | 'marked-official-candidate'
    | 'adjudicated-write-in-candidate'
    | 'adjudicated-official-candidate';
  name: string;
}

export function DoubleVoteAlertModal({
  doubleVoteAlert,
  onClose,
}: {
  doubleVoteAlert: DoubleVoteAlert;
  onClose: () => void;
}): JSX.Element {
  const { type, name } = doubleVoteAlert;
  const text = (() => {
    switch (type) {
      case 'marked-official-candidate':
        return (
          <P>
            The ballot contest has a mark for <Font weight="bold">{name}</Font>.
            Adjudicating the write-in for <Font weight="bold">{name}</Font>{' '}
            would create a double vote.
            <br />
            <br />
            If the ballot contest does indeed contain a double vote, you can
            invalidate the write-in by selecting{' '}
            <Font weight="bold">Mark write-in as undervote</Font>.
          </P>
        );
      case 'adjudicated-official-candidate':
      case 'adjudicated-write-in-candidate':
        return (
          <P>
            The ballot contest has another write-in that has already been
            adjudicated for <Font weight="bold">{name}</Font>. The current
            write-in cannot also be adjudicated for{' '}
            <Font weight="bold">{name}</Font>.
            <br />
            <br />
            If the ballot contest does indeed contain a double vote, you can
            invalidate the write-in by selecting{' '}
            <Font weight="bold">Mark write-in as undervote</Font>.
          </P>
        );
      /* istanbul ignore next */
      default:
        throwIllegalValue(type);
    }
  })();

  return (
    <Modal
      title="Possible Double Vote Detected"
      content={text}
      actions={
        <Button variant="neutral" onPress={onClose}>
          Cancel
        </Button>
      }
    />
  );
}
