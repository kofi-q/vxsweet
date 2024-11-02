/**
 * Lazily import the ToneJS library to avoid the creation of the audio worker
 * thread for apps that don't need audio (and until playback is
 * actually needed).
 *
 * ToneJS also automatically creates a global web AudioContext on import, so we
 * replace the context reference here with the one passed down from the Vx app.
 *
 * This is extracted here to enable mocking in tests.
 */
export async function getToneLib(): Promise<typeof import('tone')> {
  return await import('tone');
}
