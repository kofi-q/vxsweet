import {
  DippedSmartCardAuth,
  InsertedSmartCardAuth,
} from '@vx/libs/types/elections';

import { Main } from '../screens/main';
import { Screen } from '../screens/screen';
import { FullScreenIconWrapper, Icons } from '../primitives/icons';
import { FullScreenMessage } from '../src/full_screen_message';
import { H3 } from '../primitives/typography';
import {
  type CardInsertionDirection,
  RotateCardImage,
} from './smart_card_images';

type ReasonAndContext = Pick<
  DippedSmartCardAuth.LoggedOut | InsertedSmartCardAuth.LoggedOut,
  'reason' | 'cardJurisdiction' | 'cardUserRole' | 'machineJurisdiction'
>;

export interface Props {
  reasonAndContext: ReasonAndContext;
  recommendedAction?: string;
  cardInsertionDirection?: CardInsertionDirection;
}

export function InvalidCardScreen({
  reasonAndContext,
  recommendedAction: recommendedActionOverride,
  cardInsertionDirection,
}: Props): JSX.Element {
  const { cardJurisdiction, cardUserRole, machineJurisdiction, reason } =
    reasonAndContext;

  let graphic = (
    <FullScreenIconWrapper>
      <Icons.Warning color="warning" />
    </FullScreenIconWrapper>
  );
  let heading = 'Invalid Card';
  let errorDescription = '';
  let recommendedAction =
    recommendedActionOverride ?? 'Please insert a valid card.';

  switch (reason) {
    case 'card_error': {
      graphic = (
        <RotateCardImage cardInsertionDirection={cardInsertionDirection} />
      );
      // We've also seen a faulty card reader trigger this case, but that seems to be a much rarer
      // case than the card being backwards.
      heading = 'Card is Backwards';
      recommendedAction =
        'Remove the card, turn it around, and insert it again.';
      break;
    }
    case 'machine_not_configured': {
      errorDescription =
        'This machine is unconfigured and cannot be unlocked with this card.';
      break;
    }
    case 'wrong_election': {
      const cardString = (() => {
        switch (cardUserRole) {
          case 'election_manager':
            return 'election manager card';
          case 'poll_worker':
            return 'poll worker card';
          /* istanbul ignore next */
          default:
            return 'card';
        }
      })();
      errorDescription =
        `The inserted ${cardString} is programmed for another election ` +
        'and cannot be used to unlock this machine.';
      break;
    }
    case 'wrong_jurisdiction': {
      errorDescription =
        `The inserted card’s jurisdiction (${cardJurisdiction}) does not match ` +
        `this machine’s jurisdiction (${machineJurisdiction}).`;
      break;
    }
    default: {
      break;
    }
  }

  return (
    <Screen>
      <Main centerChild padded>
        <FullScreenMessage title={heading} image={graphic}>
          <H3 style={{ fontWeight: 'normal' }}>
            {errorDescription} {recommendedAction}
          </H3>
        </FullScreenMessage>
      </Main>
    </Screen>
  );
}
