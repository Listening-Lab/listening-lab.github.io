// One AudioContext for the whole app - Spectrogram and WindowAudioPlayer both need one
// for WAV Range-fetch decoding, and browsers cap how many contexts a page can create.
let ctx: AudioContext | null = null

export function getSharedAudioContext(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  }
  return ctx
}
