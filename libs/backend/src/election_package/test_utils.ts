import {
  type ElectionPackage,
  ElectionPackageFileName,
} from '@vx/libs/types/src';
import { Buffer } from 'node:buffer';
import {
  ELECTION_PACKAGE_FOLDER,
  generateElectionBasedSubfolderName,
} from '@vx/libs/utils/src';
import { type MockFileTree } from '@vx/libs/usb-drive/src';
import { zipFile } from '@vx/libs/test-utils/src';

/**
 * Builds an election package zip archive from a ElectionPackage object.
 */
export function createElectionPackageZipArchive(
  electionPackage: ElectionPackage
): Promise<Buffer> {
  const zipContents: Record<string, Buffer | string> = {
    [ElectionPackageFileName.ELECTION]:
      electionPackage.electionDefinition.electionData,
  };

  if (electionPackage.systemSettings) {
    zipContents[ElectionPackageFileName.SYSTEM_SETTINGS] = JSON.stringify(
      electionPackage.systemSettings,
      null,
      2
    );
  }

  if (electionPackage.uiStrings) {
    zipContents[ElectionPackageFileName.APP_STRINGS] = JSON.stringify(
      electionPackage.uiStrings,
      null,
      2
    );
  }

  if (electionPackage.uiStringAudioIds) {
    zipContents[ElectionPackageFileName.AUDIO_IDS] = JSON.stringify(
      electionPackage.uiStringAudioIds,
      null,
      2
    );
  }

  if (electionPackage.uiStringAudioClips) {
    zipContents[ElectionPackageFileName.AUDIO_CLIPS] =
      electionPackage.uiStringAudioClips
        .map((clip) => JSON.stringify(clip))
        .join('\n');
  }

  return zipFile(zipContents);
}

/**
 * Helper for mocking the file contents of on a USB drive with an election package
 * saved to it.
 */
export async function mockElectionPackageFileTree(
  electionPackage: ElectionPackage
): Promise<MockFileTree> {
  const { election, ballotHash } = electionPackage.electionDefinition;
  return {
    [generateElectionBasedSubfolderName(election, ballotHash)]: {
      [ELECTION_PACKAGE_FOLDER]: {
        'test-election-package.zip':
          await createElectionPackageZipArchive(electionPackage),
      },
    },
  };
}
