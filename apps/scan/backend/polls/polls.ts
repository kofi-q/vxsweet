import { type Result, err, ok } from '@vx/libs/basics/result';
import { assert } from '@vx/libs/basics/assert';
import { LogEventId, Logger } from '@vx/libs/logging/src';
import { type UsbDrive } from '@vx/libs/usb-drive/src';
import { Store } from '../store/store';
import { exportCastVoteRecordsToUsbDrive } from '../export/export';
import { type Workspace } from '../workspace/workspace';
import { getCurrentTime } from '../time/get_current_time';

export type OpenPollsResult = Result<void, 'ballots-already-scanned'>;

export function openPolls({
  store,
  logger,
}: {
  store: Store;
  logger: Logger;
}): OpenPollsResult {
  const previousPollsState = store.getPollsState();
  assert(previousPollsState === 'polls_closed_initial');

  // Confirm there are no scanned ballots before opening polls, in compliance
  // with VVSG 2.0 1.1.3-B, even though it should be an impossible app state.
  const sheetCount = store.getBallotsCounted();
  if (sheetCount > 0) {
    void logger.logAsCurrentRole(LogEventId.PollsOpened, {
      disposition: 'failure',
      message:
        'User prevented from opening polls because ballots have already been scanned.',
      sheetCount,
    });
    return err('ballots-already-scanned');
  }

  store.transitionPolls({ type: 'open_polls', time: getCurrentTime() });
  void logger.logAsCurrentRole(LogEventId.PollsOpened, {
    disposition: 'success',
    message: 'User opened the polls.',
  });

  const batchId = store.addBatch();
  void logger.log(LogEventId.ScannerBatchStarted, 'system', {
    disposition: 'success',
    message: 'New scanning batch started on polls opened.',
    batchId,
  });

  return ok();
}

export async function closePolls({
  workspace,
  usbDrive,
  logger,
}: {
  workspace: Workspace;
  usbDrive: UsbDrive;
  logger: Logger;
}): Promise<void> {
  const { store } = workspace;

  const previousPollsState = store.getPollsState();
  assert(
    previousPollsState === 'polls_open' || previousPollsState === 'polls_paused'
  );

  store.transitionPolls({ type: 'close_polls', time: getCurrentTime() });
  void logger.logAsCurrentRole(LogEventId.PollsClosed, {
    disposition: 'success',
    message: 'User closed the polls.',
  });

  if (previousPollsState === 'polls_open') {
    const ongoingBatchId = store.getOngoingBatchId();
    assert(ongoingBatchId !== undefined);
    store.finishBatch({ batchId: ongoingBatchId });
    void logger.log(LogEventId.ScannerBatchEnded, 'system', {
      disposition: 'success',
      message: 'Current scanning batch finished on polls closed.',
      batchId: ongoingBatchId,
    });
  }

  const isContinuousExportEnabled = store.getIsContinuousExportEnabled();
  const ballotsCounted = store.getBallotsCounted();
  if (isContinuousExportEnabled && ballotsCounted > 0) {
    const exportResult = await exportCastVoteRecordsToUsbDrive({
      mode: 'polls_closing',
      workspace,
      usbDrive,
      logger,
    });
    exportResult.assertOk(
      'Failed to finish cast vote record export to USB drive.'
    );
  }
}

export function pauseVoting({
  store,
  logger,
}: {
  store: Store;
  logger: Logger;
}): void {
  const previousPollsState = store.getPollsState();
  assert(previousPollsState === 'polls_open');

  store.transitionPolls({ type: 'pause_voting', time: getCurrentTime() });
  void logger.logAsCurrentRole(LogEventId.VotingPaused, {
    disposition: 'success',
    message: 'User paused voting.',
  });

  const ongoingBatchId = store.getOngoingBatchId();
  assert(ongoingBatchId !== undefined);
  store.finishBatch({ batchId: ongoingBatchId });
  void logger.log(LogEventId.ScannerBatchEnded, 'system', {
    disposition: 'success',
    message: 'Current scanning batch finished on voting paused.',
    batchId: ongoingBatchId,
  });
}

export function resumeVoting({
  store,
  logger,
}: {
  store: Store;
  logger: Logger;
}): void {
  const previousPollsState = store.getPollsState();
  assert(previousPollsState === 'polls_paused');

  store.transitionPolls({ type: 'resume_voting', time: getCurrentTime() });
  void logger.logAsCurrentRole(LogEventId.VotingResumed, {
    disposition: 'success',
    message: 'User resumed voting.',
  });

  const batchId = store.addBatch();
  void logger.log(LogEventId.ScannerBatchStarted, 'system', {
    disposition: 'success',
    message: 'New scanning batch started on voting resumed.',
    batchId,
  });
}

export function resetPollsToPaused({
  store,
  logger,
}: {
  store: Store;
  logger: Logger;
}): void {
  const previousPollsState = store.getPollsState();
  assert(previousPollsState === 'polls_closed_final');
  store.transitionPolls({ type: 'pause_voting', time: getCurrentTime() });
  void logger.logAsCurrentRole(LogEventId.ResetPollsToPaused, {
    disposition: 'success',
    message: 'User reset the polls to paused.',
  });
}
