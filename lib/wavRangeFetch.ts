/**
 * Fetches just the PCM bytes for one time window of a WAV file via HTTP Range requests,
 * instead of downloading the whole file to look at a few seconds of it — the difference
 * between a few hundred KB and, for a real multi-hour continuous recorder deployment
 * (the "terabytes of data" case this app needs to scale to), potentially gigabytes.
 * GCS signed URLs already support `Accept-Ranges: bytes`, so this needs no server change.
 *
 * WAV only: a canonical RIFF/WAVE file's PCM samples sit at fixed, computable byte
 * offsets once you know the format, so an arbitrary byte range is independently
 * decodable — reconstruct a tiny valid WAV (real header + just the sliced bytes) and
 * `decodeAudioData` that instead of the original. Compressed formats (mp3 etc.) don't
 * have this property — frames depend on preceding bitstream state — so callers should
 * fall back to a full fetch+decode for anything else (see Spectrogram.tsx).
 */

interface WavFormat {
  sampleRate: number
  numChannels: number
  bitsPerSample: number
  dataChunkOffset: number
  dataChunkSize: number
}

function fourCC(view: DataView, offset: number): string {
  return String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3))
}

/** Walks RIFF chunks to find `fmt ` and `data` — doesn't assume the canonical 44-byte
 * layout, since real-world WAVs often carry extra metadata chunks (LIST/INFO, etc.)
 * before the audio data. */
function parseWavHeader(buf: ArrayBuffer): WavFormat {
  const view = new DataView(buf)
  if (fourCC(view, 0) !== 'RIFF' || fourCC(view, 8) !== 'WAVE') {
    throw new Error('not a RIFF/WAVE file')
  }
  let offset = 12
  let fmt: { sampleRate: number; numChannels: number; bitsPerSample: number } | null = null
  while (offset + 8 <= view.byteLength) {
    const chunkId = fourCC(view, offset)
    const chunkSize = view.getUint32(offset + 4, true)
    const chunkStart = offset + 8
    if (chunkId === 'fmt ') {
      fmt = {
        numChannels: view.getUint16(chunkStart + 2, true),
        sampleRate: view.getUint32(chunkStart + 4, true),
        bitsPerSample: view.getUint16(chunkStart + 14, true),
      }
    } else if (chunkId === 'data') {
      if (!fmt) throw new Error('data chunk appeared before fmt chunk')
      return { ...fmt, dataChunkOffset: chunkStart, dataChunkSize: chunkSize }
    }
    offset = chunkStart + chunkSize + (chunkSize % 2) // chunks are word-aligned
  }
  throw new Error('data chunk not found within the fetched header prefix')
}

function writeString(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
}

/** Builds a standalone, valid 44-byte-header WAV around a raw PCM slice. */
function wrapPcmAsWav(pcm: ArrayBuffer, fmt: { sampleRate: number; numChannels: number; bitsPerSample: number }): ArrayBuffer {
  const blockAlign = fmt.numChannels * (fmt.bitsPerSample / 8)
  const byteRate = fmt.sampleRate * blockAlign
  const out = new ArrayBuffer(44 + pcm.byteLength)
  const view = new DataView(out)
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + pcm.byteLength, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, fmt.numChannels, true)
  view.setUint32(24, fmt.sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, fmt.bitsPerSample, true)
  writeString(view, 36, 'data')
  view.setUint32(40, pcm.byteLength, true)
  new Uint8Array(out, 44).set(new Uint8Array(pcm))
  return out
}

// Large enough to contain fmt + most real-world leading metadata chunks; if `data`
// isn't found within this, the caller's try/catch falls back to a full fetch rather
// than guessing a bigger prefix and fetching more than a full decode would have anyway.
const HEADER_PREFIX_BYTES = 65536

export async function fetchWavWindow(
  audioContext: AudioContext,
  url: string,
  offsetSeconds: number,
  windowSeconds: number
): Promise<AudioBuffer> {
  const headerResp = await fetch(url, { headers: { Range: `bytes=0-${HEADER_PREFIX_BYTES - 1}` } })
  if (headerResp.status !== 206) throw new Error('server did not honor the Range request')
  const headerBuf = await headerResp.arrayBuffer()
  const fmt = parseWavHeader(headerBuf)

  const blockAlign = fmt.numChannels * (fmt.bitsPerSample / 8)
  const byteRate = fmt.sampleRate * blockAlign
  let startByte = Math.floor(offsetSeconds * byteRate)
  startByte -= startByte % blockAlign // stay sample-aligned
  const endByte = Math.min(Math.ceil((offsetSeconds + windowSeconds) * byteRate), fmt.dataChunkSize)

  const absoluteStart = fmt.dataChunkOffset + startByte
  const absoluteEnd = fmt.dataChunkOffset + endByte - 1

  let pcm: ArrayBuffer
  if (absoluteEnd < headerBuf.byteLength) {
    // The requested window happened to already be inside the prefix we fetched for the
    // header (short files, or a window near the very start) - no second request needed.
    pcm = headerBuf.slice(absoluteStart, absoluteEnd + 1)
  } else {
    const dataResp = await fetch(url, { headers: { Range: `bytes=${absoluteStart}-${absoluteEnd}` } })
    if (dataResp.status !== 206) throw new Error('server did not honor the Range request')
    pcm = await dataResp.arrayBuffer()
  }

  return audioContext.decodeAudioData(wrapPcmAsWav(pcm, fmt))
}
