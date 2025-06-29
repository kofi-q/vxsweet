import { ElectionInfoBar } from '@vx/libs/ui/election-info';
import { Main, Screen } from '@vx/libs/ui/screens';
import { H1, H3 } from '@vx/libs/ui/primitives';
import { useContext } from 'react';
import styled from 'styled-components';
import { assertDefined } from '@vx/libs/basics/assert';
import { AppContext } from '../contexts/app_context';

const LockedImage = styled.img`
  margin-right: auto;
  margin-bottom: 1.25em;
  margin-left: auto;
  height: 20vw;
`;

export function MachineLockedScreen(): JSX.Element {
  const { electionDefinition, electionPackageHash, machineConfig } =
    useContext(AppContext);
  return (
    <Screen>
      <Main centerChild>
        <div>
          <LockedImage src="/locked.svg" alt="Locked Icon" />
          <H1 align="center">VxAdmin Locked</H1>
          <H3 style={{ fontWeight: 'normal' }}>
            {electionDefinition
              ? 'Insert system administrator or election manager card to unlock.'
              : 'Insert system administrator card to unlock.'}
          </H3>
        </div>
      </Main>
      {electionDefinition && (
        <ElectionInfoBar
          mode="admin"
          electionDefinition={electionDefinition}
          electionPackageHash={assertDefined(electionPackageHash)}
          codeVersion={machineConfig.codeVersion}
          machineId={machineConfig.machineId}
        />
      )}
    </Screen>
  );
}
