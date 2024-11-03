import { useAudioContext } from '../audio-context/audio_context';

export function useAudioEnabled(): boolean {
  return useAudioContext()?.isEnabled || false;
}
