import {
  type BallotStyleId,
  type ContestId,
  type ElectionDefinition,
  type PrecinctId,
} from './election';
import { type SystemSettings } from './system_settings';
import { type ElectionPackageMetadata } from './election_package_metadata';
import { type UiStringAudioClips } from './ui_string_audio_clips';
import { type UiStringAudioIdsPackage } from './ui_string_audio_ids';
import { type UiStringsPackage } from './ui_string_translations';

export enum ElectionPackageFileName {
  APP_STRINGS = 'appStrings.json',
  AUDIO_CLIPS = 'audioClips.jsonl',
  AUDIO_IDS = 'audioIds.json',
  ELECTION = 'election.json',
  METADATA = 'metadata.json',
  SYSTEM_SETTINGS = 'systemSettings.json',
}

export interface ElectionPackage {
  electionDefinition: ElectionDefinition;
  metadata?: ElectionPackageMetadata; // TODO(kofi): Make required
  systemSettings?: SystemSettings; // TODO(kevin): Make required
  uiStringAudioClips?: UiStringAudioClips; // TODO(kofi): Make required
  uiStringAudioIds?: UiStringAudioIdsPackage; // TODO(kofi): Make required
  uiStrings?: UiStringsPackage; // TODO(kofi): Make required
}

export interface ElectionPackageWithHash {
  electionPackage: ElectionPackage;
  /**
   * Hash of the raw election package data (in ZIP format, before it's parsed).
   * This can be used to ensure that a machine has been configured with the
   * correct election package.
   */
  electionPackageHash: string;
}

export interface BallotStyleData {
  ballotStyleId: BallotStyleId;
  contestIds: ContestId[];
  precinctId: PrecinctId;
}

export interface BallotConfig extends BallotStyleData {
  filename: string;
  layoutFilename: string;
  isLiveMode: boolean;
  isAbsentee: boolean;
}
