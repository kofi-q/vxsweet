import { useContext } from 'react';
import styled from 'styled-components';
import {
  format,
  isElectionManagerAuth,
  isSystemAdministratorAuth,
} from '@vx/libs/utils/src';
import { assert } from '@vx/libs/basics/assert';
import { Card, H2, P } from '@vx/libs/ui/primitives';
import { UnconfigureMachineButton } from '@vx/libs/ui/auth-screens/unconfigure_machine_button';
import { Seal } from '@vx/libs/ui/election-info';
import { useHistory } from 'react-router-dom';
import { AppContext } from '../contexts/app_context';
import { NavigationScreen } from '../components/navigation_screen';
import { ExportElectionPackageModalButton } from '../components/export_election_package_modal_button';
import { unconfigure } from '../api/api';
import { routerPaths } from '../paths/router_paths';

const ElectionCard = styled(Card).attrs({ color: 'neutral' })`
  margin: 1rem 0;

  > div {
    display: flex;
    gap: 1rem;
    align-items: center;
    padding: 1rem;
  }
`;

export function ElectionScreen(): JSX.Element {
  const { electionDefinition, configuredAt, auth } = useContext(AppContext);
  const history = useHistory();
  const unconfigureMutation = unconfigure.useMutation();

  assert(isSystemAdministratorAuth(auth) || isElectionManagerAuth(auth));
  assert(electionDefinition && typeof configuredAt === 'string');
  const { election } = electionDefinition;

  async function unconfigureMachine() {
    try {
      await unconfigureMutation.mutateAsync();
      history.push(routerPaths.root);
    } catch {
      // Handled by default query client error handling
    }
  }

  return (
    <NavigationScreen title="Election">
      <P>
        Configured with the current election at{' '}
        {format.localeLongDateAndTime(new Date(configuredAt))}.
      </P>
      <ElectionCard>
        <Seal seal={election.seal} maxWidth="7rem" />
        <div>
          <H2 as="h3">{election.title}</H2>
          <P>
            {election.county.name}, {election.state}
            <br />
            {format.localeLongDate(
              election.date.toMidnightDatetimeWithSystemTimezone()
            )}
          </P>
        </div>
      </ElectionCard>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <ExportElectionPackageModalButton />
        {isSystemAdministratorAuth(auth) && (
          <UnconfigureMachineButton
            isMachineConfigured
            unconfigureMachine={unconfigureMachine}
          />
        )}
      </div>
    </NavigationScreen>
  );
}
