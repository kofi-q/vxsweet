import React from 'react';
import styled from 'styled-components';
import {
  type CandidateVote,
  type YesNoVote,
  type OptionalYesNoVote,
  type Election,
  type VotesDict,
  type PrecinctId,
  getContestDistrict,
  type ContestId,
} from '@vx/libs/types/elections';
import { Caption, Card, Icons } from '@vx/libs/ui/primitives';
import { type ContestVote, VoterContestSummary } from '@vx/libs/ui/bmds';
import { Button } from '@vx/libs/ui/buttons';
import {
  appStrings,
  CandidatePartyList,
  electionStrings,
} from '@vx/libs/ui/ui_strings/ui_string';
import { NumberString, WithAltAudio } from '@vx/libs/ui/ui_strings';
import { AssistiveTechInstructions } from '@vx/libs/ui/accessible_controllers';

import { getSingleYesNoVote } from '@vx/libs/utils/src';
import {
  type CandidateContestResultInterface,
  type MsEitherNeitherContestResultInterface,
  type YesNoContestResultInterface,
} from '../config/types';

import { type ContestsWithMsEitherNeither } from '../utils/ms_either_neither_contests';

const Contest = styled.div`
  display: block;
  margin: 0 0 0.75rem;
  border: none;
  background: none;
  width: 100%;
  padding: 0;
  white-space: normal;
  color: inherit;

  button& {
    cursor: pointer;
    text-align: left;
  }
`;

function CandidateContestResult({
  contest,
  vote = [],
  election,
  selectionsAreEditable,
}: CandidateContestResultInterface): JSX.Element {
  const district = getContestDistrict(election, contest);
  const remainingChoices = contest.seats - vote.length;

  const noVotesString = selectionsAreEditable
    ? appStrings.warningNoVotesForContest()
    : appStrings.noteBallotContestNoSelection();

  return (
    <VoterContestSummary
      districtName={electionStrings.districtName(district)}
      title={electionStrings.contestTitle(contest)}
      titleType="h2"
      undervoteWarning={
        remainingChoices > 0 ? (
          vote.length === 0 ? (
            noVotesString
          ) : (
            <React.Fragment>
              {appStrings.labelNumVotesUnused()}{' '}
              <NumberString value={remainingChoices} />
            </React.Fragment>
          )
        ) : undefined
      }
      votes={vote.map(
        (candidate): ContestVote => ({
          caption: candidate.isWriteIn ? (
            appStrings.labelWriteInParenthesized()
          ) : (
            <CandidatePartyList
              candidate={candidate}
              electionParties={election.parties}
            />
          ),
          id: candidate.id,
          label: electionStrings.candidateName(candidate),
        })
      )}
    />
  );
}

function YesNoContestResult({
  vote,
  contest,
  election,
  selectionsAreEditable,
}: YesNoContestResultInterface): JSX.Element {
  const district = getContestDistrict(election, contest);
  const yesNo = getSingleYesNoVote(vote);
  const selectedOption =
    yesNo === contest.yesOption.id
      ? contest.yesOption
      : yesNo === contest.noOption.id
      ? contest.noOption
      : null;

  const votes: ContestVote[] = selectedOption
    ? [
        {
          id: selectedOption.id,
          label: electionStrings.contestOptionLabel(selectedOption),
        },
      ]
    : [];

  const noVotesString = selectionsAreEditable
    ? appStrings.warningNoVotesForContest()
    : appStrings.noteBallotContestNoSelection();

  return (
    <VoterContestSummary
      districtName={electionStrings.districtName(district)}
      title={electionStrings.contestTitle(contest)}
      titleType="h2"
      undervoteWarning={!yesNo ? noVotesString : undefined}
      votes={votes}
    />
  );
}

function MsEitherNeitherContestResult({
  contest,
  election,
  eitherNeitherContestVote,
  pickOneContestVote,
  selectionsAreEditable,
}: MsEitherNeitherContestResultInterface): JSX.Element {
  const district = getContestDistrict(election, contest);
  /* istanbul ignore next */
  const eitherNeitherVote = eitherNeitherContestVote?.[0];
  /* istanbul ignore next */
  const pickOneVote = pickOneContestVote?.[0];

  const votes: ContestVote[] = [];
  if (eitherNeitherVote) {
    votes.push({
      id: eitherNeitherVote,
      label: electionStrings.contestOptionLabel(
        eitherNeitherVote === contest.eitherOption.id
          ? contest.eitherOption
          : contest.neitherOption
      ),
    });
  }
  if (pickOneVote) {
    votes.push({
      id: pickOneVote,
      label: electionStrings.contestOptionLabel(
        pickOneVote === contest.firstOption.id
          ? contest.firstOption
          : contest.secondOption
      ),
    });
  }

  const noVotesString = selectionsAreEditable
    ? appStrings.warningNoVotesForContest()
    : appStrings.noteBallotContestNoSelection();

  return (
    <VoterContestSummary
      data-testid={`contest-${contest.id}`}
      districtName={electionStrings.districtName(district)}
      title={electionStrings.contestTitle(contest)}
      titleType="h2"
      undervoteWarning={votes.length < 2 ? noVotesString : undefined}
      votes={votes}
    />
  );
}

export interface ReviewProps {
  election: Election;
  precinctId: PrecinctId;
  contests: ContestsWithMsEitherNeither;
  votes: VotesDict;
  returnToContest?: (contestId: string) => void;
  selectionsAreEditable?: boolean;
}

export function Review({
  election,
  precinctId,
  contests,
  votes,
  returnToContest,
  selectionsAreEditable = true,
}: ReviewProps): JSX.Element {
  function onChangeClick(contestId: ContestId) {
    if (!returnToContest) {
      return;
    }
    returnToContest(contestId);
  }

  return (
    <React.Fragment>
      {contests.map((contest) => (
        <Contest
          tabIndex={0}
          role="button"
          id={`contest-${contest.id}`}
          data-testid={`contest-wrapper-${contest.id}`}
          key={contest.id}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              // Default behavior for Space key is to scroll and should be prevented.
              // See code example at https://www.w3.org/WAI/ARIA/apg/patterns/button/examples/button/
              event.preventDefault();
              onChangeClick(contest.id);
            }
          }}
          onClick={() => onChangeClick(contest.id)}
        >
          <Card
            footerAlign={selectionsAreEditable ? 'right' : undefined}
            footer={
              selectionsAreEditable && (
                <Button tabIndex={-1} onPress={() => onChangeClick(contest.id)}>
                  <Caption>
                    <WithAltAudio
                      audioText={
                        <AssistiveTechInstructions
                          controllerString={appStrings.buttonBmdReviewCardAction()}
                          patDeviceString={appStrings.buttonBmdReviewCardActionPatDevice()}
                        />
                      }
                    >
                      <Icons.Edit /> {appStrings.buttonChange()}
                    </WithAltAudio>
                  </Caption>
                </Button>
              )
            }
          >
            {contest.type === 'candidate' && (
              <CandidateContestResult
                contest={contest}
                election={election}
                selectionsAreEditable={selectionsAreEditable}
                precinctId={precinctId}
                vote={votes[contest.id] as CandidateVote}
              />
            )}
            {contest.type === 'yesno' && (
              <YesNoContestResult
                vote={votes[contest.id] as YesNoVote}
                contest={contest}
                election={election}
                selectionsAreEditable={selectionsAreEditable}
              />
            )}
            {contest.type === 'ms-either-neither' && (
              <MsEitherNeitherContestResult
                contest={contest}
                election={election}
                eitherNeitherContestVote={
                  votes[contest.eitherNeitherContestId] as OptionalYesNoVote
                }
                selectionsAreEditable={selectionsAreEditable}
                pickOneContestVote={
                  votes[contest.pickOneContestId] as OptionalYesNoVote
                }
              />
            )}
          </Card>
        </Contest>
      ))}
    </React.Fragment>
  );
}
