import { CenteredLargeProse, LoadingAnimation, H1 } from '@vx/libs/ui/src';
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
