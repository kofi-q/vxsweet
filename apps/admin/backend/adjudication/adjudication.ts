import {
  assert,
  assertDefined,
  throwIllegalValue,
} from '@vx/libs/basics/assert';
import { LogEventId, BaseLogger } from '@vx/libs/logging/src';
import {
  type VoteAdjudication,
  type WriteInAdjudicationAction,
  type WriteInRecord,
} from '../types/types';
import { type Store } from '../store/store';

/**
 * Manipulates adjudication records so that a particular vote in a cast vote
 * record reflects the target marked or unmarked status. Ensures that
 * adjudications are not created when the scanned vote is already the target
 * status.
 */
export function adjudicateVote(
  voteAdjudication: Omit<VoteAdjudication, 'id'>,
  store: Store
): void {
  // remove any existing adjudication records for the vote
  store.deleteVoteAdjudication(voteAdjudication);

  const { votes } = store.getCastVoteRecordVoteInfo({
    electionId: voteAdjudication.electionId,
    cvrId: voteAdjudication.cvrId,
  });

  const contestVotes = votes[voteAdjudication.contestId];

  const scannedIsVote = contestVotes
    ? contestVotes.includes(voteAdjudication.optionId)
    : /* istanbul ignore next */
      false;

  // if the vote is already the target status, do nothing
  if (voteAdjudication.isVote === scannedIsVote) {
    return;
  }

  store.createVoteAdjudication(voteAdjudication);
}

function logWriteInAdjudication({
  initialWriteInRecord,
  adjudicationAction,
  logger,
}: {
  initialWriteInRecord: WriteInRecord;
  adjudicationAction: WriteInAdjudicationAction;
  logger: BaseLogger;
}) {
  const { cvrId, contestId, optionId } = initialWriteInRecord;

  const formerStatusText = (() => {
    if (initialWriteInRecord.status === 'pending') {
      return 'unadjudicated';
    }

    switch (initialWriteInRecord.adjudicationType) {
      case 'invalid':
        return 'invalid';
      case 'official-candidate':
        return `a vote for an official candidate (${initialWriteInRecord.candidateId})`;
      case 'write-in-candidate':
        return `a vote for a write-in candidate (${initialWriteInRecord.candidateId})`;
      /* istanbul ignore next */
      default:
        throwIllegalValue(initialWriteInRecord, 'adjudicationType');
    }
  })();

  const newStatusText = (() => {
    switch (adjudicationAction.type) {
      case 'invalid':
        return 'invalid';
      case 'official-candidate':
        return `a vote for an official candidate (${adjudicationAction.candidateId})`;
      case 'write-in-candidate':
        return `a vote for a write-in candidate (${adjudicationAction.candidateId})`;
      case 'reset':
        return `unadjudicated`;
      /* istanbul ignore next */
      default:
        throwIllegalValue(adjudicationAction, 'type');
    }
  })();

  const message = `User adjudicated a write-in from ${formerStatusText} to ${newStatusText}.`;
  void logger.log(LogEventId.WriteInAdjudicated, 'election_manager', {
    disposition: 'success',
    message,
    cvrId,
    contestId,
    optionId,
    previousStatus:
      initialWriteInRecord.status === 'pending'
        ? 'pending'
        : initialWriteInRecord.adjudicationType,
    previousCandidateId:
      initialWriteInRecord.status === 'adjudicated' &&
      initialWriteInRecord.adjudicationType !== 'invalid'
        ? initialWriteInRecord.candidateId
        : undefined,
    status:
      adjudicationAction.type === 'reset' ? 'pending' : adjudicationAction.type,
    candidateId:
      adjudicationAction.type !== 'invalid' &&
      adjudicationAction.type !== 'reset'
        ? adjudicationAction.candidateId
        : undefined,
  });
}

/**
 * Adjudicates a write-in record for an official candidate, write-in candidate,
 * or marks it as invalid.
 */
export function adjudicateWriteIn(
  adjudicationAction: WriteInAdjudicationAction,
  store: Store,
  logger: BaseLogger
): void {
  const [initialWriteInRecord] = store.getWriteInRecords({
    electionId: assertDefined(store.getCurrentElectionId()),
    writeInId: adjudicationAction.writeInId,
  });
  assert(initialWriteInRecord, 'write-in record does not exist');

  switch (adjudicationAction.type) {
    case 'official-candidate':
      store.setWriteInRecordOfficialCandidate(adjudicationAction);
      // ensure the vote does not appear as an undervote in tallies, which is
      // only applicable to unmarked write-ins
      adjudicateVote(
        {
          ...initialWriteInRecord,
          isVote: true,
        },
        store
      );
      break;
    case 'write-in-candidate':
      store.setWriteInRecordUnofficialCandidate(adjudicationAction);
      // ensure the vote does not appear as an undervote in tallies, which is
      // only applicable to unmarked write-ins
      adjudicateVote(
        {
          ...initialWriteInRecord,
          isVote: true,
        },
        store
      );
      break;
    case 'invalid':
      store.setWriteInRecordInvalid(adjudicationAction);
      // ensure the vote appears as an undervote in tallies
      adjudicateVote(
        {
          ...initialWriteInRecord,
          isVote: false,
        },
        store
      );
      break;
    case 'reset':
      store.resetWriteInRecordToPending(adjudicationAction);
      // ensure the vote appears as it originally was in tallies
      store.deleteVoteAdjudication(initialWriteInRecord);
      break;
    /* istanbul ignore next */
    default:
      throwIllegalValue(adjudicationAction, 'type');
  }

  // if we are switching away from a write-in candidate, we may have to clean
  // up the record if it has no other references
  if (
    initialWriteInRecord.status === 'adjudicated' &&
    initialWriteInRecord.adjudicationType === 'write-in-candidate'
  ) {
    store.deleteWriteInCandidateIfNotReferenced(
      initialWriteInRecord.candidateId
    );
  }

  logWriteInAdjudication({
    initialWriteInRecord,
    adjudicationAction,
    logger,
  });
}
