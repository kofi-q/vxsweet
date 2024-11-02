import { type AudioControls } from '@vx/libs/types/src';
import { useAudioContext } from '../audio-context/audio_context';
import { useUiStringScreenReaderContext } from './ui_string_screen_reader';

function noOp() {}

/**
 * Provides an API for modifying UiString screen reader audio settings.
 *
 * Returns a stubbed-out no-op API for convenience/ease-of-testing, when used
 * without a parent `UiStringsAudioContext`.
 */
export function useAudioControls(): AudioControls {
  const audioContext = useAudioContext();
  const screenReaderContext = useUiStringScreenReaderContext();

  return {
    decreasePlaybackRate: audioContext?.decreasePlaybackRate || noOp,
    decreaseVolume: screenReaderContext?.decreaseVolume || noOp,
    increasePlaybackRate: audioContext?.increasePlaybackRate || noOp,
    increaseVolume: screenReaderContext?.increaseVolume || noOp,
    reset: audioContext?.reset || noOp,
    replay: screenReaderContext?.replay || noOp,
    setControlsEnabled: audioContext?.setControlsEnabled || noOp,
    setIsEnabled: audioContext?.setIsEnabled || noOp,
    toggleEnabled: audioContext?.toggleEnabled || noOp,
    togglePause: audioContext?.togglePause || noOp,
  };
}
