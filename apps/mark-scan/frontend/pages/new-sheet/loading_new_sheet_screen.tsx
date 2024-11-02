import { Icons, P } from '@vx/libs/ui/primitives';

import { CenteredCardPageLayout } from '../../components/centered_card_page_layout';

export function LoadingNewSheetScreen(): JSX.Element {
  return (
    <CenteredCardPageLayout
      icon={<Icons.Info />}
      title="Loading Sheet"
      voterFacing={false}
    >
      <P>
        <Icons.Loading /> Please wait while the sheet is loaded...
      </P>
    </CenteredCardPageLayout>
  );
}
