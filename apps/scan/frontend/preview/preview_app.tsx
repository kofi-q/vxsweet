// This file is for development purposes only, so linting/coverage is relaxed.
/* eslint-disable vx/gts-direct-module-export-access-only */
/* istanbul ignore file */

import {
  electionTwoPartyPrimaryDefinition,
  electionGeneralDefinition,
  electionWithMsEitherNeitherDefinition,
} from '@vx/libs/fixtures/src';
import { PreviewDashboard } from './dashboard';
import * as CardErrorScreen from '../screens/error/card_error_screen';
import * as ElectionManagerScreen from '../screens/election-manager/screen';
import * as SystemAdministratorScreen from '../screens/admin/system_administrator_screen';
import * as InsertBallotScreen from '../screens/ballots/insert_ballot_screen';
import * as InvalidCardScreen from '../screens/auth/invalid_card_screen';
import * as LoadingConfigurationScreen from '../screens/configuration/loading_configuration_screen';
import * as PollsNotOpenScreen from '../screens/not-open/polls_not_open_screen';
import * as PollWorkerScreen from '../screens/poll-worker/poll_worker_screen';
import * as ScanDoubleSheetScreen from '../screens/dsd/scan_double_sheet_screen';
import * as ScanErrorScreen from '../screens/error/scan_error_screen';
import * as ScanProcessingScreen from '../screens/scanning/scan_processing_screen';
import * as ScanSuccessScreen from '../screens/scanning/scan_success_screen';
import * as ScanWarningScreen from '../screens/warning/scan_warning_screen';
import * as ScanReturnedBallotScreen from '../screens/scanning/scan_returned_ballot_screen';
import * as ScanJamScreen from '../screens/jams/scan_jam_screen';
import * as ScanBusyScreen from '../screens/busy/scan_busy_screen';
import * as SetupScannerScreen from '../screens/error/internal_connection_problem_screen';
import * as UnconfiguredElectionScreenWrapper from '../screens/configuration/unconfigured_election_screen_wrapper';
import * as UnconfiguredPrecinctScreen from '../screens/configuration/unconfigured_precinct_screen';
import { ScanAppBase } from '../app-base/scan_app_base';

export function PreviewApp(): JSX.Element {
  return (
    <ScanAppBase>
      <PreviewDashboard
        electionDefinitions={[
          electionGeneralDefinition,
          electionTwoPartyPrimaryDefinition,
          electionWithMsEitherNeitherDefinition,
        ]}
        modules={[
          CardErrorScreen,
          ElectionManagerScreen,
          SystemAdministratorScreen,
          InsertBallotScreen,
          InvalidCardScreen,
          LoadingConfigurationScreen,
          PollsNotOpenScreen,
          PollWorkerScreen,
          ScanDoubleSheetScreen,
          ScanErrorScreen,
          ScanProcessingScreen,
          ScanSuccessScreen,
          ScanWarningScreen,
          ScanReturnedBallotScreen,
          ScanJamScreen,
          ScanBusyScreen,
          SetupScannerScreen,
          UnconfiguredElectionScreenWrapper,
          UnconfiguredPrecinctScreen,
        ]}
      />
    </ScanAppBase>
  );
}
