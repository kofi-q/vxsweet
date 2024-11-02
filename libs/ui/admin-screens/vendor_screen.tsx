import { Button } from '../buttons/button';
import { Main } from '../screens/main';
import { Screen } from '../screens/screen';
import { P } from '../primitives/typography';

interface Props {
  logOut?: () => void;
  rebootToVendorMenu: () => Promise<void>;
}

export function VendorScreen({
  logOut,
  rebootToVendorMenu,
}: Props): JSX.Element {
  return (
    <Screen>
      <Main centerChild>
        <P>
          <Button onPress={rebootToVendorMenu} variant="primary">
            Reboot to Vendor Menu
          </Button>
        </P>
        {logOut ? (
          <P>
            <Button onPress={logOut}>Lock Machine</Button>
          </P>
        ) : (
          <P>Remove the card to leave this screen.</P>
        )}
      </Main>
    </Screen>
  );
}
