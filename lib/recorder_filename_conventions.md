# Acoustic recorder naming conventions: master list

Convention IDs match `PATTERNS` in `filenameParsing.ts`. Checked in this order; the first full match wins.

## 1. Filename conventions

| ID | Pattern | Example | Devices / source | Fields | TZ in name? |
|---|---|---|---|---|---|
| `frontier_labs_start_end` | `S{YYYYMMDDThhmmss.ffffff±hhmm}_E{…}[_±lat±lon]` | `S20240815T091156.982648+1000_E20240815T091251.967555+1000_-12.34567+78.98102.wav` | Frontier Labs BAR-LT (high-precision/localisation firmware) | start, end, µs, lat/lon | yes |
| `iso_basic_T` | `[prefix_]YYYYMMDDThhmmss[.ffffff][Z/±hhmm][_Schedule][_±lat±lon]` | `20210617T080000+0000_Rec2_-18.2656+144.5564.flac` | Frontier Labs BAR/BAR-LT, Open Ecoacoustics recommended format, Ecosounds/A2O, EMU output | start, tz, schedule, lat/lon/alt | usually |
| `songmeter_sm3` | `PREFIX_0+1_YYYYMMDD_hhmmss` (`$` instead of `_` = GPS-synced clock) | `SM301297_0+1_20170912_220000.wav`, `OLONG-CH1_0+1_20171121$143444.wav` | Wildlife Acoustics SM3 | prefix/serial, channels (0+1 stereo, 0+0/1+1 mono), GPS flag | no (optional `±hhmm`) |
| `swift` | `PREFIX_YYYYMMDD_hhmmss_±hhmm` | `SwiftOne_20220719_000000_-0400.wav` | Cornell K. Lisa Yang Swift / SwiftOne | prefix, tz | yes |
| `frontier_labs_legacy_loc` | `YYYYMMDD_hhmmss_Schedule [lat lon]` (brackets, or spaces/underscores) | `20180226_040000_Bar29 [27.2819 90.1361].wav` | Older Frontier Labs BAR firmware | schedule name, lat/lon | no |
| `datetime_iso6709` | `…YYYYMMDD_hhmmss[Z]_±lat±lon[±alt][CRS…]` | `20180226_040000Z_+40.1213-075.0015+2.79CRSWGS_84.flac` | Renamed/exported files, EMU | lat/lon/alt/CRS | sometimes |
| `wa_audiomoth_standard` | `[PREFIX_]YYYYMMDD_hhmmss[_mmm][_suffix]` | `S4A01234_20220719_000000.wav`, `20200404_102500.WAV`, `FNQ-RBS_20190102_044802_010.wav` | **Most common.** WA SM2/SM4/SM4BAT/Mini/Mini Bat/Micro/Echo Meter Touch, AudioMoth fw ≥1.2.2, µMoth, HydroMoth, Arbimon-renamed | prefix (default = serial, else user site code), ms (bat triggers), suffix | no |
| `dash_datetime` | `[prefix_]YYYYMMDD-hhmmss[Z][_suffix]` | `20100503-080000Z.mp3` | Ecosounds/A2O downloads, BTO "other recorders" | start, tz | sometimes |
| `owlsense` | `OWL_SERIAL_YYYY-MM-DD_Thh-mm-ss` | `OWL_123456_2022-07-19_T00-00-00.WAV` | OwlSense | serial | no |
| `pettersson` | `[prefix]YYYY-MM-DD_HH_MM_SS[suffix]` | `ABC2010-08-26_10_39_50_M00667DEF.wav` | Pettersson D500X/D1000X after BatSound rename (raw files have no date) | prefix, suffix | no |
| `peersonic` | `[wav####_]YYYY_MM_DD__HH_MM_SS` | `Wav0123_2008_07_04__22_58_14.wav` | Peersonic after READ RPA export | sequence no. | no |
| `iso_extended` | `YYYY-MM-DDThh:mm:ss[.ffffff][Z]` (also `-` for `:`) | `2025-09-30T03:32:35.594002Z.wav` | NoiseNet, scripted exports | start, tz | sometimes |
| `soundtrap` | `SERIAL.YYMMDDhhmmss` | `5783.190101120000.wav` (+ `.sud`, `.log.xml`) | Ocean Instruments SoundTrap ST300/ST500/ST600 | serial | no (local; UTC inside .sud/.xml) |
| `upam` | `project_yymmdd_hhmmss_NUM` | `site_190101_120000_0001.wav` | Seiche µPAM | project, seq | no |
| `compact14` | `[prefix_]YYYYMMDDhhmmss` | `20070415051314.wav` | Misc. loggers, scripted renames | start | no |
| `audiomoth_hex` | 8 hex digits = UNIX epoch | `5E90A4D4.WAV` | AudioMoth firmware < 1.2.2 (pre-2019) | start | **always UTC** |
| `short_year` | `yyMMDD_hhmm` | `short_time_180801_1630_test.wav` | Misc. | start (minute precision) | no |
| `unix_epoch` | 10-digit decimal epoch | `1593000000.wav` | Custom Raspberry Pi / cloud-connected recorders | start | UTC |
| `fallback_search` | any `YYYYMMDD[_-T$]hhmmss` inside the name | `20180517_010348.5AFCD4F4.WAV`, `x.trimmed.wav` | Renamed/edited copies | start (flagged `low_confidence`) | maybe |
| `sequence_only` | counter only, no date | `10160435.wav`, `ZOOM0001.WAV`, `DR0001.WAV`, `260101_0001.WAV` | Elekon Batlogger (date in sidecar `.xml`), Zoom/Tascam/Olympus/Sony handhelds, raw Pettersson/Peersonic | none: use embedded metadata/sidecar or file mtime | n/a |

### Things that also carry metadata (easy to miss)
- **Folder names.** Very often site/deployment/device (`SiteA/SD01/…`, AudioMoth daily folders `20240501/`). Not currently used by `filenameParsing.ts` (it parses each file independently), but `MapUploadPanel`'s folder-derived-from-directory-structure field captures this separately.
- **Prefix semantics.** WA default prefix is the serial (`S4A#####` SM4, `S4U#####` SM4BAT, `SMM#####` Mini, `SMA#####` Mini 2/Micro, `SMU#####` Mini Bat). A non-serial prefix is almost always a user-set site code. The serial still appears in the embedded metadata.
- **Suffixes.** Channel (`_0`, `_1`, `_A`, `_B`), trigger/sequence number, milliseconds, or `_T` for AudioMoth amplitude-triggered files.
- **Sidecar files:** Batlogger `.xml`, SoundTrap `.log.xml`/`.sud`, Frontier `logfile.txt`/`GPS_log.gpx`, AudioMoth `CONFIG.TXT`, WA `*_Summary.txt` (per-deployment GPS, temperature, battery). Not currently parsed — filename-only for now.
- **Extensions:** `.wav`, `.flac` (Frontier, SM Mini 2), `.w4v`/`.wac` (WA compressed), `.zc` (Anabat/WA zero-crossing), `.sud` (SoundTrap).

## 2. Embedded metadata (inside the file) — not yet implemented

`filenameParsing.ts` only reads the filename. The devices/formats above without a reliable filename timestamp (`sequence_only`, and any convention where a device's true timezone offset isn't in the name) ultimately need this to be fully reliable:

| Container | Chunk / field | Written by | What you get |
|---|---|---|---|
| **GUANO** (text `guan` RIFF chunk, `Key: value` lines) | `Timestamp` (ISO 8601 with offset), `Loc Position` (lat lon), `Loc Elevation`, `Make`, `Model`, `Serial`, `Firmware Version`, `Samplerate`, `Temperature Int/Ext`, `Original Filename`, vendor namespaces `WA|`, `OAD|`, `PET|`, `Anabat|` | WA SM4/Mini/Micro/EMT (recent fw), Titley Anabat Swift/Scout/Chorus, Apodemus, Pettersson (via tools), **AudioMoth fw ≥1.10**, SonoBat/Kaleidoscope outputs | **Best single source**: time + tz + GPS + device |
| RIFF `LIST/INFO` | `ICMT` comment, `IART` artist | **AudioMoth** (all versions). `IART` = "AudioMoth <16-hex ID>"; `ICMT` = "Recorded at hh:mm:ss dd/mm/yyyy (UTC±x) by AudioMoth <ID> at <gain> gain while battery was <V> and temperature was <°C>…" (format varies by firmware) | device ID, local time + tz, gain, battery, temperature, trigger/filter settings, deployment ID |
| `wamd` chunk (binary, legacy) | model, serial, timestamp, lat/lon, mic type | Older Wildlife Acoustics SM2/SM3/EM3 | same fields as GUANO (use `guano-py` `wamd2guano`) |
| `bext` (Broadcast WAV) / `iXML` | origination date/time, device | Zoom, Tascam, Sound Devices, some Frontier | date/time (often no tz), device |
| FLAC Vorbis comments | free tags | Frontier FLAC, re-encoded files | varies |

**Precedence when this is implemented:** GUANO > vendor chunk (AudioMoth ICMT, wamd) > filename > sidecar > file mtime. Always show the source and flag `tzKnown = false` (most filenames are local time with no offset; WA and Frontier also don't apply DST).

## 3. Gotchas
- 8-digit names are ambiguous: `20230101` (date), `5E90A4D4` (AudioMoth hex), `10160435` (Batlogger counter). The parser only treats a name as hex if it contains A–F.
- Timezone: AudioMoth hex = UTC. AudioMoth ≥1.2.2 = whatever the config app set (UTC default); the true offset is in `ICMT` (not currently read — see §2). SoundTrap names = local, UTC inside. Swift/Frontier embed the offset.
- `24:00:00` appears in the wild (rolls to next-day 00:00) — `filenameParsing.ts`'s date construction relies on `Date`'s own overflow normalization for this, deliberately not bounds-checking hour/minute/second.
- Frontier FL008: spaces instead of zeros in datestamps on some firmware.

## Sources
- [Open Ecoacoustics filename standard](https://openecoacoustics.org/resources/metadata-standard/filenames/) and [EMU fixtures](https://github.com/QutEcoacoustics/emu/blob/master/test/Fixtures/FileNameParsingFixtures.csv)
- [seewave `songmeter()`](https://rdrr.io/cran/seewave/man/songmeter.html), [seewave `audiomoth()`](https://rdrr.io/cran/seewave/man/audiomoth.html)
- [kitzeslab/aru_metadata_parser](https://github.com/kitzeslab/aru_metadata_parser) (AudioMoth, SongMeter, OwlSense, Swift)
- [Wildlife Acoustics SM4 user guide](https://www.wildlifeacoustics.com/uploads/user-guides/SM4-USER-GUIDE-EN-2024-06-11.pdf)
- [BTO Acoustic Pipeline recorder advice](https://www.bto.org/data/tools-products/acoustic-pipeline/support-hub/advice-commonly-used) (Batlogger, Peersonic, Pettersson, Titley)
- [GUANO specification](https://github.com/riggsd/guano-spec/blob/master/guano_specification.md)
- [SoundTrap ST500 user guide](http://www.oceaninstruments.co.nz/wp-content/uploads/2018/03/ST500-User-Guide.pdf), [PAMGuard SUD docs](https://www.pamguard.org/olhelp/sound_processing/AcquisitionHelp/docs/sudfiles.html)
- [Open Acoustic Devices: GUANO in AudioMoth 1.10](https://x.com/OpenAcoustics/status/1792957398954459393), [metamoth](https://pypi.org/project/metamoth/1.2.1/)
- [Arbimon uploader FAQ](https://help.arbimon.org/article/279-uploader-faqs)
