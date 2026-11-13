# The Last Tram (15 s vertical short)

A silent-film short, **no voiceover** — SFX and ambience only, so there are no subtitles.
Composition id `Tram`, 1080×1920, 30 fps, 450 frames (15.000 s).

1902, night, heavy rain, a flooded cobbled street. A boy sets a paper boat on the flood, the
conductor of the last tram beckons him aboard, and the car pulls away leaving the boat bobbing
in the lamplight.

## The soundtrack is the timeline authority

`audio/CUES.md` fixes every beat. The picture is cut **to** those cues, not the other way round:

| frame | cue | what the picture must show |
|---|---|---|
| 92 | `brake_bite` | the car has stopped |
| 96–103 | `bell_x2` | bell struck twice at the stop |
| 120 | `thunder` | one distant roll behind the buildings |
| 150–344 | `lady_steps` | the lady crossing on the right pavement |
| 196–205 | `boat_set_down` | the boy sets the paper boat on the flood |
| 300 | `controller_clack` | the driver changes ends (headlamp → tail lamp) |
| 300–344 | conductor beckons | he leans out of the doorway |
| 324–352 | `boy_boards` | his boots cross the flood, **hollow metal thud on the step at 352** |
| 405 | `departure` | the car pulls away, the boat is left behind |

Registration: `Tram` in `studio/src/Root.tsx` → composer `studio/src/videos/tram/TramShort.tsx`,
which mounts `<Audio src={staticFile("audio/tram-15s.wav")} />` **inside** the composition. (The
soundtrack must be mounted here; `BridgeShort` muxes sound outside the render and would produce a
silent MP4.)

## Source map

| file | holds |
|---|---|
| `src/videos/tram/contract.ts` | frozen numbers: `STREET`, `TRAM`, `tramZ`, `LAMPS`, `NIGHT`, `GLOW` |
| `src/videos/tram/story.ts` | `SHOTS`, `XFADE`, `KICKS`, actor positions, `CAMS`/`camAt`, `DOF`, `NIGHT_GRADE` |
| `src/videos/tram/cast.ts` | the billboard characters and their baked poses |
| `src/videos/tram/tram.ts` | the car: body, lamps, doorway glow |
| `src/videos/tram/city.ts`, `weather.ts`, `toon.ts`, `wet.ts` | street, rain, drawing API, textures |
| `shorts/tram/audio/` | the cue sheet and the generators that build `public/audio/tram-15s.wav` |

Characters are camera-facing Canvas2D billboards on the `NOINK` layer. A card left outside
`TRAM.bodySide` (1.17) sits **in front of** the car's opaque side panel, so a character can only be
hidden by moving it inside the body first — switching a card off while it is still out in the street
is a visible pop.

## Build, render, QA

- Local: no GPU, so no rendering. Only `npx tsc --noEmit`, `node scripts/check-assets.mjs` (must run
  from `studio/`), the esbuild probes, and the Python audio tools run locally.
- Offline probes (choose cameras/blocking with arithmetic instead of an 8-minute render):
  `npx esbuild scripts/framing_probe.ts --bundle --platform=node --format=esm --outfile=../out/framing_probe.mjs`
  then `node ../out/framing_probe.mjs` (also `probe2.ts`, `probe3.ts`).
- Cloud render (~7–8 min, 20 chunks):
  `gh workflow run coldframe.yml --repo burhan-ahmd/quiet-mill --ref main -f composition=Tram -f chunks=20 -f min-frames-per-chunk=20 -f output-name=tram.mp4`
  then `gh run watch <id> --repo burhan-ahmd/quiet-mill --exit-status`, and
  `gh release download render-<id> --repo burhan-ahmd/quiet-mill --pattern "*.mp4" --dir E:\2026\EssouliAnas_animation_coldframe\out\cloud --clobber`.
- QA (~15–20 min): `python scripts/short_qa.py <mp4> <out\qa\tram> <out\qa\tram_shots.json>`.
  Audio-only QC: `python shorts/tram/qc_audio.py`.

## Stopping a subagent

Work is split across subagents (one task each; the primary agent drives). To stop one, interrupt its
session — the action does not revert files, so always check the working tree afterwards:

```powershell
opencode api post /api/session/<sessionID>/interrupt        # -> {"interrupted": true|false}
git status --porcelain                                      # confirm nothing half-written is left
```

Raw fallback if the CLI is unavailable — `POST http://127.0.0.1:28894/api/session/<sessionID>/interrupt`
with Basic auth `opencode:<service.json password>`. To stop the primary session itself, use the same
endpoint with the primary's session id.
