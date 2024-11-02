import React from 'react';

import { Button, type ButtonProps } from '@vx/libs/ui/buttons';

import * as api from '../api/api';

interface Props {
  /** @default 'Deactivate Voting Session' */
  children?: React.ReactNode;

  /** @default 'Delete' */
  icon?: ButtonProps['icon'];

  /** @default 'danger' */
  variant?: ButtonProps['variant'];
}
export type { Props as ResetVoterSessionButtonProps };

export function ResetVoterSessionButton(props: Props): React.ReactNode {
  const {
    children = 'Deactivate Voting Session',
    icon = 'Delete',
    variant = 'danger',
  } = props;

  const endSessionMutation = api.endCardlessVoterSession.useMutation();

  return (
    <Button
      disabled={endSessionMutation.isLoading}
      icon={icon}
      variant={variant}
      onPress={endSessionMutation.mutate}
    >
      {children}
    </Button>
  );
}
