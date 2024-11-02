import { ElectionInfoBar } from '@vx/libs/ui/election-info';
import { InsertCardImage } from '@vx/libs/ui/auth-screens';
import { Main, Screen } from '@vx/libs/ui/screens';
import { Font, H1, H3 } from '@vx/libs/ui/primitives';
import { useContext } from 'react';
import styled from 'styled-components';

import { assertDefined } from '@vx/libs/basics/src';
import { AppContext } from '../../contexts/app_context';

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
      <Main padded centerChild>
        {electionDefinition ? (
          <Font align="center">
            <LockedImage src="/locked.svg" alt="Locked Icon" />
            <H1>VxCentralScan is Locked</H1>
            <H3 style={{ fontWeight: 'normal' }}>
              Insert an election manager card to unlock.
            </H3>
          </Font>
        ) : (
          <Font align="center">
            <InsertCardImage cardInsertionDirection="right" />
            <H1 align="center" style={{ maxWidth: '27rem' }}>
              Insert an election manager card to configure VxCentralScan
            </H1>
          </Font>
        )}
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
