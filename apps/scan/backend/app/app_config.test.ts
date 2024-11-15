jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
  };
});

import * as electionFamousNames2021Fixtures from '@vx/libs/fixtures/src/data/electionFamousNames2021';
import * as electionGeneralLib from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import * as electionTwoPartyPrimaryFixtures from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary';
import { LogEventId } from '@vx/libs/logging/src';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
  singlePrecinctSelectionFor,
} from '@vx/libs/utils/src';
import { err, ok } from '@vx/libs/basics/result';
import {
  mockElectionManagerUser,
  mockSessionExpiresAt,
  mockOf,
} from '@vx/libs/test-utils/src';
import { mockElectionPackageFileTree } from '@vx/libs/backend/election_package';
import { type InsertedSmartCardAuthApi } from '@vx/libs/auth/inserted-cards';
import {
  constructElectionKey,
  type ElectionDefinition,
} from '@vx/libs/types/elections';
import { convertVxfElectionToCdfBallotDefinition } from '@vx/libs/types/cdf';
import { safeParseElectionDefinition } from '@vx/libs/types/election-parsing';
import { configureApp } from '../test/helpers/shared_helpers';
import { withApp } from '../test/helpers/pdi_helpers';
import { type PrecinctScannerPollsInfo } from '../types/types';
const electionGeneral = electionGeneralLib.election;
const electionGeneralDefinition = electionGeneralLib.toElectionDefinition();

jest.setTimeout(30_000);

const mockFeatureFlagger = getFeatureFlagMock();

function mockElectionManager(
  mockAuth: InsertedSmartCardAuthApi,
  electionDefinition: ElectionDefinition
) {
  mockOf(mockAuth.getAuthStatus).mockImplementation(() =>
    Promise.resolve({
      status: 'logged_in',
      user: mockElectionManagerUser({
        electionKey: constructElectionKey(electionDefinition.election),
      }),
      sessionExpiresAt: mockSessionExpiresAt(),
    })
  );
}

function mockLoggedOut(mockAuth: InsertedSmartCardAuthApi) {
  mockOf(mockAuth.getAuthStatus).mockImplementation(() =>
    Promise.resolve({ status: 'logged_out', reason: 'no_card' })
  );
}

beforeEach(() => {
  mockFeatureFlagger.resetFeatureFlags();
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
  );
});

test('uses machine config from env', async () => {
  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    VX_MACHINE_ID: 'test-machine-id',
    VX_CODE_VERSION: 'test-code-version',
  };

  await withApp(({ api }) => {
    expect(api.getMachineConfig()).toEqual({
      machineId: 'test-machine-id',
      codeVersion: 'test-code-version',
    });
  });

  process.env = originalEnv;
});

test('uses default machine config if not set', async () => {
  await withApp(({ api }) => {
    expect(api.getMachineConfig()).toEqual({
      machineId: '0000',
      codeVersion: 'dev',
    });
  });
});

test("fails to configure if there's no election package on the usb drive", async () => {
  await withApp(async ({ api, mockAuth, mockUsbDrive, logger }) => {
    mockElectionManager(mockAuth, electionGeneralDefinition);
    mockUsbDrive.insertUsbDrive({});
    expect(await api.configureFromElectionPackageOnUsbDrive()).toEqual(
      err('no_election_package_on_usb_drive')
    );

    expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
      LogEventId.ElectionConfigured,
      expect.objectContaining({
        disposition: 'failure',
      })
    );

    mockUsbDrive.insertUsbDrive({});
    expect(await api.configureFromElectionPackageOnUsbDrive()).toEqual(
      err('no_election_package_on_usb_drive')
    );
  });
});

test('fails to configure election package if logged out', async () => {
  await withApp(async ({ api, mockAuth }) => {
    mockLoggedOut(mockAuth);
    expect(await api.configureFromElectionPackageOnUsbDrive()).toEqual(
      err('auth_required_before_election_package_load')
    );
  });
});

test('fails to configure election package if election definition on card does not match that of the election package', async () => {
  await withApp(async ({ api, mockUsbDrive, mockAuth }) => {
    mockElectionManager(
      mockAuth,
      electionFamousNames2021Fixtures.electionJson.toElectionDefinition()
    );
    mockUsbDrive.insertUsbDrive(
      await mockElectionPackageFileTree({
        electionDefinition: electionGeneralDefinition,
      })
    );
    expect(await api.configureFromElectionPackageOnUsbDrive()).toEqual(
      err('election_key_mismatch')
    );
  });
});

test("if there's only one precinct in the election, it's selected automatically on configure", async () => {
  const electionDefinition =
    electionTwoPartyPrimaryFixtures.asSinglePrecinctElectionDefinition();
  await withApp(async ({ api, mockUsbDrive, mockAuth, logger }) => {
    mockElectionManager(mockAuth, electionDefinition);
    mockUsbDrive.insertUsbDrive(
      await mockElectionPackageFileTree({
        electionDefinition,
      })
    );
    expect(await api.configureFromElectionPackageOnUsbDrive()).toEqual(ok());
    expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
      LogEventId.ElectionConfigured,
      expect.objectContaining({
        disposition: 'success',
      })
    );
    const config = api.getConfig();
    expect(config.precinctSelection).toMatchObject({
      kind: 'SinglePrecinct',
      precinctId: 'precinct-1',
    });
    expect(config.electionDefinition).toEqual(electionDefinition);
    expect(config.electionPackageHash).toEqual(expect.any(String));
  });
});

test('setPrecinctSelection will reset polls to closed', async () => {
  await withApp(async ({ api, mockUsbDrive, mockAuth, logger }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    expect(api.getPollsInfo()).toEqual<PrecinctScannerPollsInfo>({
      pollsState: 'polls_open',
      lastPollsTransition: {
        type: 'open_polls',
        time: expect.anything(),
        ballotCount: 0,
      },
    });

    api.setPrecinctSelection({
      precinctSelection: singlePrecinctSelectionFor('21'),
    });
    expect(api.getPollsInfo()).toEqual<PrecinctScannerPollsInfo>({
      pollsState: 'polls_closed_initial',
    });
    expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
      LogEventId.PrecinctConfigurationChanged,
      {
        disposition: 'success',
        message: 'User set the precinct for the machine to East Lincoln',
      }
    );
  });
});

test('setTestMode false will reset polls to closed', async () => {
  await withApp(async ({ api, mockUsbDrive, mockAuth, logger }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    expect(api.getPollsInfo()).toEqual<PrecinctScannerPollsInfo>({
      pollsState: 'polls_open',
      lastPollsTransition: {
        type: 'open_polls',
        time: expect.anything(),
        ballotCount: 0,
      },
    });

    expect(logger.logAsCurrentRole).toHaveBeenCalledTimes(5);
    await api.setTestMode({
      isTestMode: false,
    });
    expect(logger.logAsCurrentRole).toHaveBeenCalledTimes(7);
    expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
      LogEventId.ToggledTestMode,
      {
        disposition: 'success',
        message: expect.anything(),
        isTestMode: false,
      }
    );
    expect(api.getPollsInfo()).toEqual<PrecinctScannerPollsInfo>({
      pollsState: 'polls_closed_initial',
    });
  });
});

test('setIsSoundMuted logs', async () => {
  await withApp(async ({ api, mockUsbDrive, mockAuth, logger }) => {
    await configureApp(api, mockAuth, mockUsbDrive);
    expect(api.getConfig()).toMatchObject(
      expect.objectContaining({
        isSoundMuted: false,
      })
    );

    api.setIsSoundMuted({
      isSoundMuted: true,
    });
    expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
      LogEventId.SoundToggled,
      {
        disposition: 'success',
        message: expect.anything(),
        isSoundMuted: true,
      }
    );
    expect(api.getConfig()).toMatchObject(
      expect.objectContaining({
        isSoundMuted: true,
      })
    );
  });
});

test('unconfiguring machine', async () => {
  await withApp(async ({ api, mockUsbDrive, workspace, mockAuth, logger }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    jest.spyOn(workspace, 'reset');

    api.unconfigureElection();

    expect(workspace.reset).toHaveBeenCalledTimes(1);
    expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
      LogEventId.ElectionUnconfigured,
      expect.objectContaining({
        disposition: 'success',
      })
    );
  });
});

test('configure with CDF election', async () => {
  await withApp(async ({ api, mockUsbDrive, mockAuth }) => {
    const cdfElection =
      convertVxfElectionToCdfBallotDefinition(electionGeneral);
    const cdfElectionDefinition = safeParseElectionDefinition(
      JSON.stringify(cdfElection)
    ).unsafeUnwrap();
    await configureApp(api, mockAuth, mockUsbDrive, {
      electionPackage: {
        electionDefinition: cdfElectionDefinition,
      },
    });

    const config = api.getConfig();
    expect(config.electionDefinition!.election.id).toEqual(electionGeneral.id);

    // Ensure loading auth election key from db works
    mockElectionManager(mockAuth, cdfElectionDefinition);
    expect(await api.getAuthStatus()).toMatchObject({
      status: 'logged_in',
    });
  });
});
