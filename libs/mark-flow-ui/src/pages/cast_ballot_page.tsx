import styled from 'styled-components';

import { Button } from '@vx/libs/ui/buttons';
import { H1, Icons, P } from '@vx/libs/ui/primitives';
import { InsertBallotImage } from '@vx/libs/ui/ballots';
import { VerifyBallotImage } from '@vx/libs/ui/bmds';
import { ReadOnLoad } from '@vx/libs/ui/ui_strings';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { VoterScreen } from '../components/voter_screen';

const Instructions = styled.ol`
  display: flex;
  flex-direction: column;
  margin: 2rem 0;
  padding: 0;

  @media (orientation: landscape) {
    flex-direction: row;
    justify-content: space-around;
    gap: 1rem;
    margin: 0.5rem;
  }
`;

const ListItem = styled.li`
  align-items: center;
  display: flex;
  font-weight: ${(p) => p.theme.sizes.fontWeight.semiBold};
  gap: 1rem;
  margin-bottom: 1.5rem;

  @media (orientation: landscape) {
    flex-direction: column;
    margin-bottom: 0.5rem;
  }
`;

const InstructionImageContainer = styled.div`
  border-right: ${(p) => p.theme.sizes.bordersRem.thick}rem solid
    ${(p) => p.theme.colors.outline};
  display: flex;
  justify-content: center;
  padding: 1rem 1rem 0 0;
  width: 30vw;

  @media (orientation: landscape) {
    border: none;
    width: 30vh;
  }
`;

interface Props {
  hidePostVotingInstructions: () => void;
  printingCompleted?: boolean;
}

export function CastBallotPage({
  hidePostVotingInstructions,
  printingCompleted,
}: Props): JSX.Element {
  return (
    <VoterScreen
      actionButtons={
        <Button
          onPress={hidePostVotingInstructions}
          variant="primary"
          icon="Done"
        >
          {appStrings.buttonDone()}
        </Button>
      }
      padded
    >
      <ReadOnLoad>
        <H1>{appStrings.titleBmdCastBallotScreen()}</H1>
        <P>
          {printingCompleted
            ? appStrings.instructionsBmdCastBallotPreamblePostPrint()
            : appStrings.instructionsBmdCastBallotPreamble()}
        </P>
        <Instructions>
          <ListItem>
            <InstructionImageContainer>
              <VerifyBallotImage />
            </InstructionImageContainer>
            <span>{appStrings.instructionsBmdCastBallotStep1()}</span>
          </ListItem>
          <ListItem>
            <InstructionImageContainer>
              <InsertBallotImage disableAnimation />
            </InstructionImageContainer>
            <span>{appStrings.instructionsBmdCastBallotStep2()}</span>
          </ListItem>
        </Instructions>
        <P>
          <Icons.Info /> {appStrings.noteAskPollWorkerForHelp()}
        </P>
      </ReadOnLoad>
    </VoterScreen>
  );
}
