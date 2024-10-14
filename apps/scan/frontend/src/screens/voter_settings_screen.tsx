import { useHistory } from 'react-router-dom';

import { VoterSettings } from '@vx/libs/ui/src';

export function VoterSettingsScreen(): JSX.Element {
  const history = useHistory();

  return <VoterSettings onClose={history.goBack} />;
}
