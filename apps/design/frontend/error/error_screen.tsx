import {
  AppLogo,
  LeftNav,
  FullScreenIconWrapper,
  H1,
  Icons,
} from '@vx/libs/ui/src';
import { Column, Row } from '../layout/layout';

export function ErrorScreen(): JSX.Element {
  return (
    <Row style={{ flex: 1, width: '100%' }}>
      <LeftNav style={{ width: '14rem' }}>
        <a href="/">
          <AppLogo appName="VxDesign" />
        </a>
      </LeftNav>
      <Column
        style={{
          flex: 1,
          padding: '1rem',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FullScreenIconWrapper>
          <Icons.Danger />
        </FullScreenIconWrapper>
        <H1>Something went wrong</H1>
      </Column>
    </Row>
  );
}
