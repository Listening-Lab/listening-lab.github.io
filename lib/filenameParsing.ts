/**
 * Infers a recording's `recordedAt` (and, where the convention encodes it, lat/lon) from
 * its filename, covering the field-recorder naming conventions catalogued in
 * `recorder_filename_conventions.md` — a faithful port of that doc's reference
 * implementation (`recorder_metadata.py`), verified against its own self-test filenames.
 * `PATTERNS` is ordered most-specific/most-common -> least-specific, matching the
 * reference exactly; the first full match wins. A device's saved `filenameFormat` (if
 * any) is tried first, then the full list in that same order, then a loose fallback scan
 * — see `parseFilename`. Every result stays user-editable; this is a first guess, not a
 * source of truth.
 */

// ---------------------------------------------------------------- building blocks
const D8 = String.raw`(?<date>\d{8})` // YYYYMMDD
const T6 = String.raw`(?<time>\d{6})` // hhmmss
const FRAC = String.raw`(?:\.?(?<frac>\d{3,6}))?` // .SSS / .SSSSSS
const TZ = String.raw`(?<tz>Z|[+-]\d{2}:?\d{2}|\+Z)?` // Z, +1000, -04:30
const PRE = String.raw`(?:(?<prefix>[A-Za-z0-9\-]+?)_)?` // optional prefix_
const SUF = String.raw`(?:_(?<suffix>.+))?` // optional _anything
const LOC =
  String.raw`[ _\[]*(?<lat>[+-]?\d{1,2}(?:\.\d+)?)[ ]?(?<lon>[+-]\d{1,3}(?:\.\d+)?|\d{1,3}\.\d+)` +
  String.raw`(?<alt>[+-]\d+(?:\.\d+)?)?(?:CRS\w+)?[\]_ ]*`

// ---------------------------------------------------------------- master pattern list
export type FilenameConvention =
  | 'frontier_labs_start_end' | 'iso_basic_T' | 'songmeter_sm3' | 'swift'
  | 'frontier_labs_legacy_loc' | 'datetime_iso6709' | 'wa_audiomoth_standard'
  | 'dash_datetime' | 'owlsense' | 'pettersson' | 'peersonic' | 'iso_extended'
  | 'soundtrap' | 'upam' | 'compact14' | 'audiomoth_hex' | 'short_year'
  | 'unix_epoch' | 'sequence_only'

/** Kept as the public "device format preference" type — same set as FilenameConvention,
 *  named separately since it's the DeviceManager-facing vocabulary. */
export type FilenameFormat = FilenameConvention

const PATTERNS: [FilenameConvention, string][] = [
  // Frontier Labs BAR/BAR-LT high-precision start+end (localisation firmware)
  ['frontier_labs_start_end',
    `S${D8}T${T6}${FRAC}${TZ}_E(?<end>\\d{8}T\\d{6}\\.?\\d*(?:Z|[+-]\\d{4})?)(?:_${LOC})?`],
  // Frontier Labs BAR / Open Ecoacoustics recommended ISO-8601 basic, optional schedule + location
  ['iso_basic_T',
    `${PRE}${D8}T${T6}${FRAC}${TZ}(?:_(?<schedule>[A-Za-z][\\w\\-]*?))?(?:_?${LOC})?(?:_(?<suffix>[^\\[\\]]+))?`],
  // Song Meter SM3: PREFIX_0+1_YYYYMMDD_hhmmss ('$' = GPS-synced clock)
  ['songmeter_sm3',
    String.raw`(?<prefix>[A-Za-z0-9\-]+)_(?<channels>[01][+-][01])_` + D8 + String.raw`(?<gps>[_$T])` + T6 + TZ],
  // Cornell Swift: PREFIX_YYYYMMDD_hhmmss_+HHMM (UTC offset embedded)
  ['swift', `${PRE}${D8}_${T6}_(?<tz>[+-]\\d{4})`],
  // Frontier Labs legacy: YYYYMMDD_hhmmss_Schedule [lat lon]
  ['frontier_labs_legacy_loc', `${D8}_${T6}_(?<schedule>[\\w\\-]+?)${LOC}`],
  // Standard datetime + ISO 6709 coords: 20180226_040000Z_+40.1213-075.0015+2.79CRSWGS_84
  ['datetime_iso6709',
    `${PRE}${D8}[_T]${T6}${FRAC}${TZ}_(?<lat>[+-]\\d{1,2}(?:\\.\\d+)?)(?<lon>[+-]\\d{1,3}(?:\\.\\d+)?)` +
    `(?<alt>[+-]\\d+(?:\\.\\d+)?)?(?:CRS\\w+)?(?:_(?<suffix>.+))?`],
  // Wildlife Acoustics SM2/SM4/Mini/Micro/SM4BAT/EMT + AudioMoth >=1.2.2 (+ ms suffix for bat triggers)
  ['wa_audiomoth_standard',
    `${PRE}${D8}_${T6}(?:_(?<frac>\\d{3}))?${TZ}(?:_(?<suffix>(?!\\d{3}$).*))?`],
  // Generic YYYYMMDD-hhmmss(Z) (Ecosounds/A2O exports, BTO 'other recorders')
  ['dash_datetime', `${PRE}${D8}-${T6}${TZ}${SUF}`],
  // OwlSense: OWL_123456_2022-07-19_T00-00-00
  ['owlsense',
    String.raw`OWL_(?<serial>\d+)_(?<Y>\d{4})-(?<m>\d{2})-(?<d>\d{2})_T(?<H>\d{2})-(?<M>\d{2})-(?<S>\d{2})`],
  // Pettersson (after BatSound rename): [prefix]YYYY-MM-DD_HH_MM_SS[suffix]
  ['pettersson',
    String.raw`(?<prefix>[A-Za-z]*)(?<Y>\d{4})-(?<m>\d{2})-(?<d>\d{2})_(?<H>\d{2})_(?<M>\d{2})_(?<S>\d{2})(?<suffix>.*)`],
  // Peersonic (READ RPA): [wav####_]YYYY_MM_DD__HH_MM_SS
  ['peersonic',
    String.raw`(?:(?<prefix>[Ww]av\d+)_)?(?<Y>\d{4})_(?<m>\d{2})_(?<d>\d{2})__(?<H>\d{2})_(?<M>\d{2})_(?<S>\d{2})`],
  // ISO extended (NoiseNet etc.): 2025-09-30T03:32:35.594002Z
  ['iso_extended',
    String.raw`(?<Y>\d{4})-(?<m>\d{2})-(?<d>\d{2})[T_ ](?<H>\d{2})[:\-](?<M>\d{2})[:\-](?<S>\d{2})` +
    String.raw`(?:\.(?<frac>\d+))?(?<tz>Z|[+-]\d{2}:?\d{2})?`],
  // Ocean Instruments SoundTrap: SERIAL.YYMMDDhhmmss (local time)
  ['soundtrap', String.raw`(?<serial>\d+)\.(?<yy>\d{6})(?<time>\d{6})`],
  // Seiche uPAM: project_yymmdd_hhmmss_NUM
  ['upam', String.raw`(?<prefix>.+?)_(?<yy>\d{6})_(?<time>\d{6})_(?<seq>\d+)`],
  // Compact 14-digit YYYYMMDDhhmmss
  ['compact14', `${PRE}${D8}${T6}${SUF}`],
  // AudioMoth firmware <1.2.2: 8-hex UNIX epoch, always UTC. Must contain a letter to avoid YYYYMMDD clash.
  ['audiomoth_hex', String.raw`(?<hex>(?=[0-9A-Fa-f]*[A-Fa-f])[0-9A-Fa-f]{8})`],
  // Short year yyMMDD_hhmm
  ['short_year', String.raw`(?<prefix>.*?)_?(?<yy>\d{6})_(?<hm>\d{4})(?:_(?<suffix>.*))?`],
  // Decimal UNIX epoch
  ['unix_epoch', String.raw`(?<epoch>1\d{9})`],
  // No datetime in name -> must use embedded metadata / sidecar (Batlogger 8-digit + .xml,
  // Zoom/Tascam/Olympus ZOOM0001 etc., Peersonic raw, Pettersson raw). Kept for fidelity
  // with the reference's pattern list, but see the loop in parseFilename below — a match
  // that yields no date never wins, so this (and unix_epoch/short_year on a non-date
  // number) can never falsely claim a filename another convention could have dated.
  ['sequence_only', String.raw`(?<prefix>[A-Za-z_\-]*?)(?<seq>\d{3,8})`],
]

const FALLBACK = new RegExp(
  String.raw`(?<!\d)(?<date>(?:19|20)\d{6})[_\-T$]?(?<time>[0-2]\d[0-5]\d[0-5]\d)(?!\d)(?<tz>Z|[+-]\d{2}:?\d{2})?`
)
const COMPILED: [FilenameConvention, RegExp][] = PATTERNS.map(([name, p]) => [name, new RegExp(`^(?:${p})$`)])

const AUDIO_EXT_RE = /\.(wav|flac|mp3|wac|w4v|aac|ogg|m4a|opus|zc|sud|mpg)$/i

type Groups = Record<string, string>

function groupsOf(m: RegExpExecArray): Groups {
  const g: Groups = {}
  for (const [k, v] of Object.entries(m.groups ?? {})) if (v) g[k] = v // Python's `if v` - drops both absent and empty-string captures
  return g
}

/** Mirrors Python's `_tz`: minutes offset from a TZ capture, or null for "no zone in the
 *  name" (naive/local) vs 0 for an explicit 'Z'/'+Z'. */
function tzOffsetMinutes(s: string | undefined): number | null {
  if (!s) return null
  if (s === 'Z' || s === '+Z') return 0
  const clean = s.replace(':', '')
  const sign = clean[0] === '+' ? 1 : -1
  return sign * (parseInt(clean.slice(1, 3), 10) * 60 + parseInt(clean.slice(3, 5), 10))
}

/** Mirrors Python's `_dt`. Throws on an out-of-range month/day (e.g. an 8-digit number
 *  that isn't really a date) so the caller can fall through to the next pattern. */
function buildDate(g: Groups): Date | null {
  if (g.hex) return new Date(parseInt(g.hex, 16) * 1000)
  if (g.epoch) return new Date(parseInt(g.epoch, 10) * 1000)

  let y: string, mo: string, d: string
  if (g.date) { y = g.date.slice(0, 4); mo = g.date.slice(4, 6); d = g.date.slice(6, 8) }
  else if (g.yy) { y = '20' + g.yy.slice(0, 2); mo = g.yy.slice(2, 4); d = g.yy.slice(4, 6) }
  else if (g.Y) { y = g.Y; mo = g.m; d = g.d }
  else return null

  const t = g.time || (g.hm ? g.hm + '00' : undefined) || `${g.H}${g.M}${g.S}`
  const yearNum = parseInt(y, 10), monthNum = parseInt(mo, 10), dayNum = parseInt(d, 10)
  const hh = parseInt(t.slice(0, 2), 10), mm = parseInt(t.slice(2, 4), 10), ss = parseInt(t.slice(4, 6), 10)
  // Matches the reference's actual validation exactly: only month/day are checked (its
  // datetime(y, m, d) constructor is the only thing that can raise there); hour/minute/
  // second are never bounds-checked, added as elapsed time instead (timedelta in Python,
  // Date's own overflow normalization here) - deliberately permissive, since "24:00:00"
  // rolling to next-day 00:00 is a real, documented recorder quirk, not a rejection case.
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
    throw new RangeError('not a real date')
  }
  const fracStr = (g.frac ?? '0').padEnd(6, '0').slice(0, 6)
  const ms = Math.round(parseInt(fracStr, 10) / 1000)

  const tzMin = tzOffsetMinutes(g.tz)
  if (tzMin !== null) {
    // Explicit zone: build the real UTC instant.
    return new Date(Date.UTC(yearNum, monthNum - 1, dayNum, hh, mm, ss, ms) - tzMin * 60_000)
  }
  // No zone in the filename ("naive", same as Python's tz-less datetime) - construct in
  // the browser's own local time zone, so a datetime-local input round-trips the exact
  // wall-clock digits the filename encoded, whatever the viewer's zone happens to be.
  return new Date(yearNum, monthNum - 1, dayNum, hh, mm, ss, ms)
}

export interface FilenameMatch {
  convention: FilenameConvention | 'fallback_search' | null
  recordedAt: Date | null
  /** True when the filename itself carried an explicit UTC offset/'Z' - false means
   *  `recordedAt` is a best-effort local-time guess (see buildDate above). */
  tzKnown: boolean
  lat: number | null
  lon: number | null
  /** Set on a loose fallback-scan match (a YYYYMMDD/hhmmss found amid otherwise
   *  unrecognized junk) rather than a full-filename convention match - worth flagging as
   *  less trustworthy than a named convention's result. */
  lowConfidence?: boolean
}

const EMPTY_MATCH: FilenameMatch = { convention: null, recordedAt: null, tzKnown: false, lat: null, lon: null }

/**
 * Full parse: convention id, recordedAt, and lat/lon where the convention encodes them
 * (Frontier Labs / ISO-6709-style filenames carry GPS coordinates right in the name).
 * `preferredConvention` (typically a saved device's `filenameFormat`) is tried first;
 * on no match (or a match with no extractable date - see the loop below), every other
 * convention is tried in the reference doc's most-common-first order, then a loose
 * fallback scan, before giving up.
 */
export function parseFilename(filename: string, preferredConvention?: string | null): FilenameMatch {
  const stem = filename.replace(AUDIO_EXT_RE, '')

  let order = COMPILED
  if (preferredConvention) {
    const preferred = COMPILED.find(([name]) => name === preferredConvention)
    if (preferred) order = [preferred, ...COMPILED.filter(([name]) => name !== preferredConvention)]
  }

  for (const [convention, rx] of order) {
    const m = rx.exec(stem)
    if (!m) continue
    const g = groupsOf(m)
    let dt: Date | null
    try { dt = buildDate(g) } catch { continue } // e.g. an 8-digit number that isn't a real date
    if (!dt) continue // a structural match with nothing dateable (sequence_only et al.) - keep looking
    return {
      convention,
      recordedAt: dt,
      tzKnown: !!g.tz,
      lat: g.lat !== undefined ? parseFloat(g.lat) : null,
      lon: g.lon !== undefined ? parseFloat(g.lon) : null,
    }
  }

  const fb = FALLBACK.exec(stem)
  if (fb) {
    const g = groupsOf(fb)
    try {
      const dt = buildDate(g)
      if (dt) return { convention: 'fallback_search', recordedAt: dt, tzKnown: !!g.tz, lat: null, lon: null, lowConfidence: true }
    } catch { /* not a real date either - give up below */ }
  }
  return EMPTY_MATCH
}

/** Back-compat convenience wrapper for callers that only need the date (the upload
 *  staging table's primary use case). */
export function inferRecordedAt(filename: string, preferredFormat?: string | null): Date | null {
  return parseFilename(filename, preferredFormat).recordedAt
}
