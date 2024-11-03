import { useHistory } from 'react-router-dom';

import { VoterSettings } from '@vx/libs/ui/voter_settings';

export function VoterSettingsPage(): JSX.Element {
  const history = useHistory();

  return <VoterSettings onClose={history.goBack} allowAudioVideoOnlyToggles />;
}
