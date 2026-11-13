# Claude Animated Shorts: ready to run

> **New video? The AI agent must read [`INSTRUCTIONS.md`](INSTRUCTIONS.md) first** — it is the complete
> operating manual for this repo: the cloud-only rendering pipeline, the exact commands, the measured
> speeds, and every problem + solution learned while building it. Always work in this repo folder;
> every new video is a new folder inside `studio/src/videos/`.

Make 60-second animated story shorts with Claude Code: flat cartoon characters in a colourful 3D world, ink
outlines, gliding cameras, voice, music and sound effects. Every frame is three.js code rendered by Remotion on
your own PC. No AI video generator.

Based on the free skill by **Mr omi** ([mromidev/claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts), MIT).
This copy adds what you need to run it on the first try: a ready Remotion project, a one-command setup, an
automatic download of the free 3D models, and fixes for the problems that stop a fresh install.

## Setup (once, ~5 minutes)

You need [Claude Code](https://claude.com/claude-code), [Node.js](https://nodejs.org) LTS, Python 3 and ffmpeg.

```bash
git clone https://github.com/EssouliAnas/claude-animated-shorts
cd claude-animated-shorts
```

Windows:
```powershell
powershell -ExecutionPolicy Bypass -File setup.ps1
```

macOS / Linux:
```bash
bash setup.sh
```

The setup installs the packages, downloads the free Kenney 3D models, sets a render temp folder on your biggest
drive, and links the skill into `~/.claude/skills/` so Claude Code finds it.

## Make a short

Open Claude Code in this folder and say:

> Use the cartoon short skill and make a short about the Great Molasses Flood of 1919.

Claude then checks the facts, writes the script, makes the voice, plans the shots, renders still frames and checks
them, fixes what looks wrong, then renders the video and the sound. Approve the script when it asks; after that it
runs on its own. Expect a few hours for a full short (renders run at a few frames per second).

Want to see it work first? Render stills of the included example:

```bash
cd studio
node scripts/bridge-stills.mjs out/bridge/test_ 100,700,1500
```

Or open it in the Remotion preview with `npm run studio`.

## Voice

- **ElevenLabs** (easiest): put `ELEVENLABS_API_KEY=...` in your environment and Claude generates the voice and the
  word timings.
- **Your own voice**: record the script, save it as `studio/shorts/<name>/voice/voice.wav`, and Claude makes the word
  timings with speech-to-text.

## What's inside

| Path | What it is |
|---|---|
| `SKILL.md` | The skill: the full pipeline, every rule, every fix and the final look values |
| `setup.ps1`, `setup.sh` | One-command setup |
| `studio/` | The Remotion project. `src/videos/bridge/` is the example short, the template for every new one |
| `studio/shorts/bridge/` | The example's script and sound scripts (synthesized SFX, music, mix) |
| `studio/scripts/` | Model download, still renders, side-by-side sheets, sandbox merge, frame-by-frame QA |
| `references/` | The measured style formula and seven look reports (colour, ink, light, depth, motion, textures, characters) |

## What this copy fixes compared to the original

1. **No project to run it in.** The original ships source files only. This one is a complete Remotion project
   (`studio/package.json`, entry, composition, config) that type-checks and renders.
2. **Missing 3D models.** The code loads 26 Kenney models that aren't included. `scripts/get-models.mjs`
   downloads the two free kits and copies them, including the texture the town models need.
3. **Chrome path.** The stills script expected Chrome in one fixed folder. It now uses Remotion's own browser
   (set `CHROME=...` to use yours).
4. **Full disk.** Every render leaves a copy of `public/` in the temp folder. Setup points `REMOTION_TMP` at your
   biggest drive.
5. **Paths.** The skill pointed at folders on the original author's machine; everything is now relative to this
   folder.
6. **Newer packages.** A type error with the current `@react-three/postprocessing` is fixed.

## Notes

- Your story, characters and voice should always be your own. The references are for the look, not the content.
- The original repo includes reference frames from the channel it studied. They are not redistributed here; the
  measured numbers in `references/` are enough for the look checks.
- 3D models: [Kenney](https://kenney.nl) Nature Kit and Fantasy Town Kit, CC0.

## Cloud rendering with coldframe

This copy renders in the cloud with [coldframe](https://github.com/Razee4315/coldframe): GitHub Actions
machines render the video in parallel, every chunk carries its exact PCM slice of the soundtrack, the
pieces are joined without re-encoding, and the frame count is verified before the MP4 is delivered.

What was added on top of the original project:

- `ColdframeSmokeTest` (450 frames = 15 s @ 30 fps, 1080x1920): the story's first 450 frames through the
  same `BridgeShort` 3D world (models, cast, camera, lighting, ink/DOF/bloom/grade), with the film's own
  first 15 s of music + SFX committed as `public/audio/smoke-15s.wav` (synthesized by
  `shorts/bridge/audio/smoke_audio.py`; no voice, no API keys, no personal recordings).
- `public/bridge/kenney/`: the 26 Kenney CC0 models + colormap are committed, so the cloud bundle always
  finds them (`get-models.mjs` still skips its download when they are already present).
- `scripts/check-assets.mjs` + the `verify-assets` job in `.github/workflows/coldframe.yml`: fails loudly
  before any render minute is spent if a model, the texture or the soundtrack is missing.
- The custom workflow calls coldframe's reusable `render.yml` with `project-dir: studio`, `gl: swangle`
  (software WebGL on GPU-less runners), `frame-timeout: 300000` and `chunk-timeout: 120` for the heavy
  three.js scene.

Render in the cloud (from this folder, `gh` authenticated). `--chunks` = parallel machines (1-20, use 20);
public repo = unlimited free minutes:

```bash
npx github:Razee4315/coldframe render ColdframeSmokeTest --chunks 20 --name coldframe-smoke-450.mp4
```

The finished MP4 lands in `out/cloud/` — and the workflow also publishes it as a GitHub Release asset
(fast download, no auth, never expires). Measured: 450 frames on 20 machines ≈ **10 min wall**; see
`INSTRUCTIONS.md` §4–5 for the planning formula and the fast-download bake-off. Change the
composition id to render something else; `BridgeShort` (the full 2,025-frame film) renders the same way.

Regenerate the smoke-test soundtrack after changing the audio pipeline:

```bash
cd studio/shorts/bridge/audio
python smoke_audio.py   # writes studio/public/audio/smoke-15s.wav, then commit it
```

## License

MIT (see `LICENSE`), keeping the original author's copyright.
