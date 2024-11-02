import { CenteredLargeProse } from '@vx/libs/ui/src';
import { LoadingAnimation } from '@vx/libs/ui/spinners';
import { H1 } from '@vx/libs/ui/primitives';
import { ScreenMainCenterChild } from '../../components/layout/layout';

export function LoadingConfigurationScreen(): JSX.Element {
  return (
    <ScreenMainCenterChild voterFacing={false}>
      <LoadingAnimation />
      <CenteredLargeProse>
        <H1>Loading Configuration…</H1>
      </CenteredLargeProse>
    </ScreenMainCenterChild>
  );
}

/* istanbul ignore next */
export function DefaultPreview(): JSX.Element {
  return <LoadingConfigurationScreen />;
}
