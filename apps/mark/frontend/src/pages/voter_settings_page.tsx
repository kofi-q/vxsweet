import { useHistory } from 'react-router-dom';

import { VoterSettings } from '@vx/libs/ui/src';

export function VoterSettingsPage(): JSX.Element {
  const history = useHistory();

  return <VoterSettings onClose={history.goBack} allowAudioVideoOnlyToggles />;
}
