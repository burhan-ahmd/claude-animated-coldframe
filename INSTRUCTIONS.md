# INSTRUCTIONS.md — Cloud Animation Pipeline

**Read this file top-to-bottom before doing anything.** It is the complete operating manual for
producing a finished vertical animated video (1080×1920, 30 fps, MP4 with soundtrack) from a
topic, a script, or a voiceover + SRT — using **only cloud rendering on GitHub Actions** with
up to 20 parallel machines at zero cost.

> One public repo renders every video: **https://github.com/burhan-ahmd/quiet-mill**
> (branch `main`). Local machine only authors files and downloads results — it never renders.

---

## 0. GOLDEN RULES (violating these wastes hours)

1. **NEVER render or test frames locally.** The local machine has NO GPU (~17 s/frame in
   software vs ~7.8 s/frame average on GitHub's runners × 20 machines). All rendering and all
   frame testing happens in the cloud. Local work = authoring files, running the asset check,
   and QA-ing the downloaded MP4.
2. **One public repo for everything.** Public repo = **unlimited free Actions minutes** and every
   machine bills nothing. Private would burn the 2,000 min/month quota fast (a 20-machine render
   uses ~100–2,200 machine-minutes). Never make it private.
3. **Verify before claiming success.** Never say "done" until the MP4 is downloaded, ffprobe-verified
   (frame count exact) and QA has been run and eyeballed.
4. **No secrets in the repo.** Never commit `.env`, API keys, or tokens. Default to the repo's own
   synthesized audio stems (CC0) — upload a personal voiceover only if the user explicitly provides
   it for that video.
5. **The workflow file must be on `main`** before dispatching (`workflow_dispatch` only reads the
   default branch).
6. **Assets are checked BEFORE any render machine starts** — the `verify-assets` job gates the
   render. If it fails, fix assets; do not retry the render.
7. **The repo is a platform, not a one-off.** Every new video = new composition folder + assets in
   the same repo. `git push` to `main`, dispatch, done.
8. **A voiceover video MUST ship with on-screen subtitles, in the locked house style.** If the
   composition plays narration (any voice `<Audio>` track), it must also burn **word-synced captions**
   into the picture — one word at a time in **Lilita One**, off-white fill, thick ink outline, hard
   offset shadow, at 75% height (exact values: Step 3). Never restyle the captions per video, never
   pick a different font, never ask the user about the caption style again — it is decided. No
   exceptions for "narration-only" cuts, and no separate `.srt` sidecar: most vertical platforms show
   no captions by default and many people watch muted. Captions are pixels: adding them later means
   re-rendering the whole film, so build them **before** the first full render. Recipe in Step 3.
   (Silent videos — music/SFX only — have no subtitles.)

---

## 1. WHAT EXISTS (repo layout)

Local working copy: `E:\2026\EssouliAnas_animation_coldframe\render-repo\claude-animated-coldframe\`
Upstream references (read-only, do not modify): `E:\2026\EssouliAnas_animation_coldframe\repos\` contains pristine clones of `claude-animated-shorts` (the animation source) and `coldframe` (the render engine).

```
claude-animated-coldframe/               ← local folder; the public repo is github.com/burhan-ahmd/quiet-mill
├── INSTRUCTIONS.md                      ← this file (pipeline law)
├── SKILL.md                             ← craft law (v2.2): story formula, camera, captions, look values
├── README.md                            ← quick-start
├── CHANGELOG.md                         ← skill version history (v2.0 → v2.2)
├── LICENSE                              ← MIT (original skill + v2 additions + this copy)
├── .github/workflows/coldframe.yml      ← THE render workflow (dispatch with knobs + craft gate)
├── setup.ps1                            ← one-time local setup (npm + Kenney models)
├── scripts/fastdl.ps1                   ← parallel-segment fast downloader for release assets
└── studio/                              ← the Remotion + three.js project
    ├── package.json
    ├── src/Root.tsx                     ← register every composition here
    ├── src/videos/                      ← compositions, one folder per video topic
    │   ├── bridge/                      ← example: SmokeTest.tsx (450f), BridgeShort.tsx (2025f)
    │   │   └── flow.ts / framing.ts / Captions.tsx   ← v2 craft files — copy into every new video
    │   ├── fredlorz/                    ← voiceover reference: captions.tsx + generated words.ts (subtitles)
    │   └── noonbell/                    ← 30 s short (900 frames)
    ├── templates/                       ← SHOT_PLAN_template.md + example scripts (fill before building)
    ├── public/                          ← static assets, COMMITTED so every cloud machine sees them
    │   ├── bridge/kenney/               ← 26 CC0 GLB models + Textures/colormap.png
    │   ├── fonts/                       ← caption face + its licence (Lilita One, OFL)
    │   └── audio/                       ← soundtracks (e.g. smoke-15s.wav, 15.000 s verified)
    ├── shorts/<topic>/audio/            ← Python audio generators (music.py, sfx.py, smoke_audio.py)
    ├── shorts/<topic>/build_words.py    ← word onsets → captions data module (voiceover videos)
    └── scripts/
        ├── check-assets.mjs             ← asset gate (every referenced GLB + audio must exist)
        ├── flow_selftest.ts             ← CI craft gate: camera-flow maths
        ├── framing_selftest.ts          ← CI craft gate: safe-area/framing maths
        └── short_qa.py                  ← frame-by-frame QA of a downloaded MP4
└── references/                          ← style study (committed from the upstream v2.2 repo)
    ├── STYLE_BIBLE.md + reports/        ← the measured look numbers
    ├── frames/                          ← 38 reference stills — agents LOOK at these before building
    └── sheets/                          ← 20 contact sheets, one per reference short
```

Outputs land locally (gitignored, never committed):
`E:\2026\EssouliAnas_animation_coldframe\out\cloud\` (MP4s) and `out\qa\` (QA sheets).

---

## 1.5. THE V2 CRAFT LAYER (SKILL.md) — who owns which law

The repo was upgraded (2026-11-14) to **Claude Animated Shorts v2.2** from
`alifmahmudashik/shorts-studio-skill` (MIT, the next generation of the same skill lineage). There
are now two law books, and they do not overlap:

| | `INSTRUCTIONS.md` (this file) | `SKILL.md` (v2.2) |
|---|---|---|
| Owns | the **pipeline**: cloud rendering, one public repo, delivery, QA, measured numbers | the **craft**: story formula, comedy, camera flow, framing, captions, lighting, look values |
| Read it | before touching the workflow | before writing a new video's story.ts / Captions usage |

**What v2 added (all committed):**
- `references/frames/` (38 stills) + `references/sheets/` (20 contact sheets) — the visual style
  reference, committed from the upstream MIT repo per owner decision (2026-11-14). An agent starting
  a new video should LOOK at these first: they show the target characters, lighting and composition
  better than any text. The studied channel's videos stay private: never copy their scripts,
  characters or shots, never name the channel.
- `CHANGELOG.md` — upstream's v2.0 → v2.2 change log (what each version added).
- `studio/src/videos/bridge/flow.ts` — continuous camera: one unbroken move chains subjects
  (tower → crowd → face) instead of cuts. `flow(stops)`, `lookFrom()`, `flowFocus()`, `checkFlow()`.
- `studio/src/videos/bridge/framing.ts` — safe-area / head-size / foreground-blob checks:
  `checkShot(camera, items)` throws before you render a bad shot.
- `studio/src/videos/bridge/Captions.tsx` — generic word-by-word captions, **defaults = the locked
  house style** (see §3). Accepts any STT `words.json` via `normalizeWords()`; per-shot
  `yPercent` dodges faces; accent colour exists but is OFF (house fill is locked off-white).
- `studio/scripts/flow_selftest.ts` + `framing_selftest.ts` — run in CI (`verify-assets` job, now
  "Verify assets + craft gate") and locally before every push.
- `studio/templates/` — `SHOT_PLAN_template.md` (fill one row per shot BEFORE building), plus two
  example scripts (bridge disaster formula, viral comedy formula).
- `SKILL.md` — the full v2 craft manual (viral six-beat format, comedy engine, per-place lighting,
  set-dressing minimums, reaction/dialogue rules, quality gate, measured look values).

**Rules for the new video workflow:** copy `flow.ts`, `framing.ts`, `Captions.tsx` from `bridge/`
into every new video folder; run `checkShot` on first/middle/last frame of every shot; fill the
shot plan template first; read SKILL.md's 'Rules for every video' (six rules) and 'Quality gate'
before dispatching. The 11 upstream engine files were verified byte-identical to ours — only the
new files above were missing; our `Bridge.tsx`/`bridge_merge.py`/`bridge-stills.mjs` fixes are kept
(they are newer than upstream's).

---

## 2. PREREQUISITES (check once, per machine)

- `gh` CLI authenticated with `repo` + `workflow` scopes → `gh auth status`
- `git` identity set → `git config user.name` / `user.email` must be non-empty
- Node 22 (`node -v`) — needed for `check-assets.mjs`
- Python 3 with `numpy` + `Pillow` — needed for `short_qa.py`
- `ffmpeg` on PATH (any build ≥ 4.x) — used by QA. **Do NOT use Remotion's bundled
  `node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe` for QA — it is a minimal build
  (no `rawvideo` muxer, no `ebur128`).** Its `ffprobe.exe` IS fine for probing.
- If ever needed locally: `$env:REMOTION_TMP = "C:/remotion-tmp"` (only D: drive space is scarce).

---

## 3. THE NEW-VIDEO WORKFLOW (topic / script / voiceover → finished MP4)

Total realistic time budget: **15–45 min end-to-end**, almost all of it cloud time (which is free).

### Step 1 — Update the working copy
```powershell
cd E:\2026\EssouliAnas_animation_coldframe\render-repo\claude-animated-coldframe
git pull origin main
```

### Step 2 — Turn the input into a shot plan
Timing is everything. **30 fps: `frame = round(seconds × 30)`; 1 s of video = 30 frames.**
- **Topic only:** write the script first. Narration at ~2.4 words/s → a 15 s short ≈ 36 words,
  a 60 s short ≈ 145 words. Split the script into shots of 3–5 s (90–150 frames) each. Write a
  shot map JSON (see Step 6) with `{id, a, b}` frame ranges.
- **Script provided:** same, but the shot text is already fixed — just assign frame ranges.
- **Voiceover + SRT provided:** timing comes FROM the SRT. `shot start = ceil(SRT start × 30)`,
  `shot end = ceil(SRT end × 30)`. Total composition frames = `ceil(last SRT end × 30) + 30`
  (breathing room). The voice WAV becomes the master clock — the video length follows it.

### Step 3 — Create the composition
- New folder `studio/src/videos/<topic>/` with `<Name>.tsx`.
- **Copy the structure of `studio/src/videos/bridge/SmokeTest.tsx`** — it is the minimal known-good
  pattern: a full three.js scene + `<Audio src={staticFile("audio/<your>.wav")} />` wrapper.
  `BridgeShort.tsx` in the same folder shows the full-film pattern (camera glides, shot system).
- Read frames with `useCurrentFrame()`; absolute timing only, no randomness without a seeded PRNG
  (chunk machines must produce identical frames for the same frame number — they re-bundle the
  same code, but any `Math.random()` non-determinism shows as chunk-boundary glitches).
- Register in `studio/src/Root.tsx`:
  ```tsx
  <Composition id="YourVideo" component={YourVideo} durationInFrames={N} fps={30} width={1080} height={1920} />
  ```
- `id` must be unique per video; this id is what you pass to the render.

#### Subtitles — MANDATORY when the video has a voiceover (rule 8)

Reference implementation: `studio/shorts/fredlorz/build_words.py` → `src/videos/fredlorz/words.ts`
+ `src/videos/fredlorz/captions.tsx` (built for the Fred Lorz film; one word at a time, popping).
**Equivalent generic component (v2): `src/videos/bridge/Captions.tsx`** — same locked house look by
default (Lilita One 176 px etc.), but driven by `normalizeWords()` which accepts any STT's
`words.json` (seconds or ms, `{word|text, start|start_time, end|end_time}`) and supports a per-shot
`yPercent={(frame) => ...}` to dodge faces. Use the generic component when you have a words.json;
use the fredlorz `build_words.py` → `words.ts` pattern when you build timings from an SRT yourself.
Silent videos skip this. Everything below is the part that goes wrong if you skip it.

- **Timing comes from the word onsets, never from your own guess.** Generate a data module instead of
  hand-writing frames: a small `studio/shorts/<topic>/build_words.py` reads the SRT/`word.txt` and
  writes `src/videos/<topic>/words.ts` — one `{a, b, w}` per word, gap-free, `a` of card *n+1* = `b`
  of card *n*, and the table must cover frame 0 through the last frame (no uncovered frame, or
  `cardAt()` silently falls back).
- **Two repairs are always needed on real ASR output, and both must only ever push a word later:**
  1. a **non-monotonic** onset (transcribers do emit words out of order — Fred's file lists `life.`
     at 26.16 s *after* `A` at 26.04 s) is pulled to ~50 ms after the previous word, keeping the
     spoken order;
  2. a card is **never replaced sooner than 3 frames** after it appeared — six words in that
     narration were 2–3 frames apart, which is an unreadable flash.

  Then measure the drift those repairs cost and state the worst case in the commit. Under ~2 frames
  (67 ms) is invisible; the Fred film's worst is 1.5 f on `A`.
- **Draw it above the crossfade stack.** `<WordCaptions />` must be a **sibling** of the shot map in
  the `AbsoluteFill` (`{layersAt(f).map(...)} <WordCaptions />`), never inside a shot — otherwise a
  fading place fades its caption mid-swap.
- **The caption look is LOCKED — it is the user's house style.** Every voiceover video uses exactly
  this style, never a per-video restyle, never another font:

  | | value (from the `CAP` object in `src/videos/fredlorz/captions.tsx`) |
  |---|---|
  | face | **Lilita One** — OFL, committed at `studio/public/fonts/LilitaOne-Regular.ttf` |
  | size | 176 px, `lineHeight: 1`, `letterSpacing: "-0.01em"`, `whiteSpace: "nowrap"` |
  | fill | `#fbf7ef` (off-white) |
  | outline | 13 px `#17161d`, `paintOrder: "stroke fill"` |
  | shadow | hard offset only, `0 10px 0 rgba(23,22,29,0.28)` — **no blur** |
  | position | `centreY 1450` (75% of 1920), horizontally centred, 40 px side insets |
  | motion | 5-frame pop: scale `0.90 → 1.00` + `0.04·sin(πk)` overshoot, rising 16 px, `transformOrigin 50% 50%` |
  | rhythm | one word at a time, replaced on its measured onset |

  Start every new video by copying `src/videos/fredlorz/captions.tsx` and changing **nothing** but
  the timing import (`words.ts`). If a film genuinely needs different treatment, ask the user first —
  do not invent a variant.
- **Commit the font, and load it behind `delayRender`.** Cloud runners have no font you can rely on;
  a silent fallback changes every glyph's width and the whole look. The `.ttf` + its licence live
  under `studio/public/fonts/`, loaded with the `FontFace` API, and `continueRender()` is only called
  after `await face.load()` (`cancelRender(e)` on failure). Note this TS DOM lib lacks
  `FontFaceSet.add` — cast: `(document.fonts as unknown as Set<FontFace>).add(face)`.
- **Size it from the real `hmtx` advances, not by eye.** Compute the widest card in em, then pick a
  size where it still clears ~150 px of each edge (Lilita One, widest `Roosevelt` = 4.199 em →
  739 px at 176 px). Re-check if a new script has a longer word — the 176 px is a measured value, not
  a taste value.
- **`-webkit-text-stroke` splits the stroke across the glyph edge** (only half is outside), so judge
  the outline width on a **full-resolution crop**, never on a thumbnail.
- **Gate the font in `scripts/check-assets.mjs`** — the render then fails in seconds instead of after
  20 machines have run.
- **Subtitles mean a full re-render.** They are burned into the pixels; there is no caption track to
  add to an existing MP4. Build them before dispatch and count them in the frame budget.

### Step 4 — Models
- Reuse the committed CC0 kit: `studio/public/bridge/kenney/` (26 GLBs + `Textures/colormap.png`).
- New models (only if the story needs them): download CC0 GLBs into
  `studio/public/<topic>/models/` and **commit them** (cloud machines check out the repo —
  nothing can be downloaded at render time).
- **Warning:** `loadKit()` silently DROPS missing model files (per-model `.catch`). A missing
  model = a scene silently missing objects. This is why the asset gate and visual QA exist.

### Step 5 — Audio
- **No voiceover (topic/script mode):** follow the pattern in
  `studio/shorts/bridge/audio/smoke_audio.py` — select stems from the repo's `music.py`/`sfx.py`
  generators, slice to the exact video duration, master to **−16 LUFS integrated / −2.2 dBTP /
  48 kHz stereo 24-bit WAV**, write to `studio/public/audio/<video>.wav`. Verify with ffprobe
  (`duration` must match the composition exactly).
- **Voiceover provided:** put the WAV/MP3 at `studio/public/audio/voice.<ext>`, add `<Audio src={staticFile("audio/voice.<ext>")} />` as the master track, and mix a music bed well under it
  (music ≈ −30 LUFS short-term under speech). **A voiceover video also needs burned-in word-synced
  subtitles — rule 8, recipe in Step 3.** Worked end-to-end reference: `src/videos/fredlorz/`
  (voice + music + SFX mastered to −16 LUFS / −1.2 dBTP, captions from `new_story/word.txt`).
- Never use `Math.random()` for note placement (see Step 3 determinism rule).

### Step 6 — Write the QA shot map
Create `out/qa/<video>_shots.json` (this drives `short_qa.py`):
```json
{"shots": [{"id": 1, "a": 0, "b": 130}, {"id": 2, "a": 130, "b": 283}],
 "flash": [130, 134], "xfade": []}
```
`flash` / `xfade` ranges are planned effects that QA must ignore when flagging white/black frames.

### Step 7 — Asset + craft gate (local, fast, mandatory)
```powershell
cd studio; node scripts/check-assets.mjs
npx tsx scripts/flow_selftest.ts     # camera-flow maths (no node_modules needed)
npx tsx scripts/framing_selftest.ts  # safe-area/framing maths
cd ..
npx tsc --noEmit                     # run inside studio/
```
`check-assets` verifies every GLB/audio path referenced by the composition exists. The self-tests
verify the v2 craft helpers (continuous camera flow, safe-area checks) still pass. CI runs all of
this again as the `verify-assets` job; the render never starts if it fails. Fix errors here, not in
the cloud.

### Step 8 — Commit + push (one repo, every video)
```powershell
git add -A
git status   # EYEBALL: no .env, no _cache/, no keys, no files you can't justify
git commit -m "Add <video>: composition + audio + shot map"
git push origin main
```

### Step 9 — Render in the cloud (the ONLY place rendering happens)
**Full render (recommended default — a 15 s video costs ~10 min wall, free):**
```powershell
npx github:Razee4315/coldframe render YourVideo --chunks 20 --name your-video.mp4
```
**Equivalent workflow dispatch (works from any folder, good for scripts):**
```powershell
gh workflow run coldframe.yml --repo burhan-ahmd/quiet-mill --ref main `
  -f composition=YourVideo -f chunks=20 -f min-frames-per-chunk=20 `
  -f output-name=your-video.mp4
$run = gh run list --repo burhan-ahmd/quiet-mill --limit 1 --json databaseId --jq ".[0].databaseId"
```
- `--chunks` = parallel machines (max **20**). For videos < 400 frames, fewer machines are
  auto-used because of the chunk-size floor (see §4).
- **New/unknown composition?** Do a cloud smoke first: render it fully if ≤ 450 frames, or
  (longer video) create a short `<Name>Test` variant comp of the first ~90 frames and render
  that. **Never smoke-test locally.**

### Step 10 — Monitor
```powershell
gh run watch $run --repo burhan-ahmd/quiet-mill --interval 15 --exit-status
```
Run this in the BACKGROUND and continue other work — you get notified at completion.
- **Live view while running = the web UI only** (status dots auto-refresh):
  `https://github.com/burhan-ahmd/quiet-mill/actions/runs/<run-id>`
- **Per-frame logs are NOT readable via API while a job runs** (the endpoint returns
  `BlobNotFound`). They become fetchable the moment each job completes:
  `gh run view $run --job <jobId> --log` or `gh api repos/.../actions/jobs/<jobId>/logs`.

### Step 11 — Download FAST (see §5 for why/how)
The moment the run succeeds, background this (never block on it):
```powershell
gh run download $run --repo burhan-ahmd/quiet-mill `
  --name your-video --dir E:\2026\EssouliAnas_animation_coldframe\out\cloud
```
The workflow ALSO publishes the MP4 as a **GitHub Release asset** (fast CDN, permanent, no auth):
`https://github.com/burhan-ahmd/quiet-mill/releases/tag/render-<run-id>`
— download from there with a plain browser or curl. Pick whichever link is faster that day.

### Step 12 — QA (mandatory before telling the user "done")
```powershell
$ws = "E:\2026\EssouliAnas_animation_coldframe"
$mp4 = "$ws\out\cloud\your-video.mp4"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames:format=duration -of default $mp4
# expect: 1080x1920, 30/1, nb_frames == composition length, AAC 48 kHz stereo, duration ≈ frames/30
python studio\scripts\short_qa.py $mp4 "$ws\out\qa" "$ws\out\qa\<video>_shots.json
```
Then EYEBALL: (a) the keyframes at every chunk boundary (`b-1`,`b` of each chunk — see §4 for
boundary math, extract with `ffmpeg -vf "select=eq(n\,224)+eq(n\,225)"`), (b) 2–3 contact sheets
(`sheet_*.jpg`). Report.md verdict must show no black/white/frozen/unplanned-pop frames.
Finally: `browser.preview` the MP4 so the user can watch it immediately.

---

## 4. CLOUD RENDERING — HOW IT WORKS + MEASURED NUMBERS

**Engine:** `coldframe` (Razee4315/coldframe@v1, reusable workflow called by our
`.github/workflows/coldframe.yml`). Pipeline: `Plan` job bundles the project and splits the frame
range → N chunk machines each render their slice to lossless MKV (h264 + PCM audio, swangle
software-WebGL, 4 parallel workers per machine) → `Stitch + deliver` concatenates losslessly,
encodes audio to AAC **once**, verifies the frame count, uploads the artifact — and (since this
repo's fast-download job) attaches the MP4 to a GitHub Release.

**Knobs that matter:**
| Knob | Value | Why |
|---|---|---|
| `chunks` | ≤ 20 | max parallel machines |
| `min-frames-per-chunk` | 20 (default) | chunks get capped at `floor(frames ÷ min-frames-per-chunk)`; 450 frames ÷ 20 = 23-frame chunks |
| `gl` | `swangle` | runners have no GPU; software WebGL, visually identical |
| `frame-timeout` | `300000` ms | heavy 3D frames (MSAA 4 + ink + DOF + bloom) exceed the 120 s default |
| `chunk-timeout` | `120` min | a stuck chunk must not burn hours |

**Measured (450-frame test, 20 machines, run 43366515481 — real numbers):**
- Wall clock dispatch → MP4 artifact: **10 min 15 s** (queue 45 s, Plan 39 s, slowest chunk 9.02 min, stitch+verify 24 s)
- Per-machine throughput: **avg 7.8 s/frame** (light wide shots 3.4 s, heavy soldier close-ups ~15 s)
- Setup cost per machine ≈ 2–3 min (checkout, node, Chrome deps, npm install, artifact download)
- Total machine-time: 104.8 machine-minutes (= free on the public repo)
- Cloud ≈ **2× faster per frame than the local no-GPU machine** (16.8 s/frame), ×20 machines on top

**Planning formula (minutes):** `wall ≈ 4 + (frames ÷ 20) × perFrameSec ÷ 60`, using `perFrameSec` ≈ 7.8 optimistic → ~15 pessimistic (heaviest content / stragglers).
- 450 frames → 7–10 min (measured 10:15)
- 2,025 frames (full film) → **16–30 min**
- **Wall time is governed by the SLOWEST chunk** (stragglers: chunks 16/18 took 2× the median in
  the measured run). More machines ≠ linear speedup. For a heavy final render consider
  `chunks=20, min-frames-per-chunk=10` on videos ≤ 200 frames to balance loads.

**Machine-minute cost:** ≈ `Σ chunk wall time`. 20-machine render of 450 frames ≈ 105 min;
2,025 frames ≈ 2,200 min. Public repo → $0. Never switch to private for renders.

---

## 5. FAST DOWNLOAD AFTER RENDER (the delivery optimization)

**Problem observed:** `gh run download` of the 35 MB final MP4 took minutes and, run in the
foreground, blocked everything.

**Fixes (all in place):**
1. **Always download in the background** the moment the run completes, and do QA prep meanwhile.
2. **The workflow publishes every finished MP4 as a GitHub Release asset** (the
   `fast-download` job in `coldframe.yml`, `needs: render`, `continue-on-error` so it can never
   break a successful render). Release assets:
   - download via CDN, no `gh` auth needed,
   - **never expire** (artifacts auto-delete after 90 days).
3. **Use the release asset** (single-stream `curl` is enough — see measured speeds below;
   `scripts/fastdl.ps1` exists for parallel segments but gave no extra gain on a ~1.4 MB/s line):
   ```powershell
   curl.exe -sL --retry 3 -o "E:\2026\EssouliAnas_animation_coldframe\out\cloud\<file>.mp4" `
     "https://github.com/burhan-ahmd/quiet-mill/releases/download/render-<run-id>/<file>.mp4"
   ```
   **Measured bake-off (34 MB MP4, run 43369948536):**
   | Path | Time | Speed |
   |---|---|---|
   | `gh run download` (artifact) | **149 s** | 0.23 MB/s ← the slow old path |
   | release asset, single-stream curl | **23.9 s** | 1.4 MB/s = the line's full speed |
   | release asset, parallel ×8 (`fastdl.ps1`) | ~22 s | no gain — line-limited |
   All three copies SHA256-identical → the release path is byte-exact. **Rule of thumb: release +
   curl ≈ 6× faster; the floor is the connection (~1.4 MB/s here).** Start the download in the
   background the second the run turns green and do QA prep meanwhile.
   `fastdl.ps1` verifies every segment size and the final total, so a truncated download cannot
   pass silently; keep it for larger files or faster connections.
4. **Don't download the 20 `coldframe-part-XX` artifacts** — only the final one
   (`--name <output-name-without-.mp4>`). The parts are only needed to re-stitch manually (never
   needed so far).
5. **Verify what landed:** SHA256 of the downloaded MP4 against the release-asset expectation, or
   at minimum ffprobe `nb_frames` before QA. A fast download that lies is worse than a slow one.

---

## 6. ISSUES FACED → SOLUTIONS (learned the hard way; don't repeat them)

| # | Issue | Solution |
|---|---|---|
| 1 | Per-frame logs unavailable while a job runs (`BlobNotFound` from the API) | Live view = web UI only; `gh run watch` in background for completion; fetch logs only after jobs finish |
| 2 | Remotion's bundled `ffmpeg.exe` failed QA with 0 frames decoded | It's a minimal build (no `rawvideo` muxer, no `ebur128`). Use system ffmpeg for QA; Remotion's `ffprobe.exe` is fine for probing |
| 3 | Full-res raw frame pipe would be ~2.8 GB (32-bit ffmpeg OOM risk) | `short_qa.py` scales to 180×320 **before** piping (~77 MB) — 32-bit ffmpeg handles it. Never pipe full-res raw frames |
| 4 | Measuring binary output through PowerShell pipes corrupts it | Never measure binary in PowerShell pipelines; Python `subprocess` is binary-safe |
| 5 | ffmpeg `select=eq(n,130)` broke in PowerShell | Escape the commas: `select=eq(n\,130)+eq(n\,134)`, avoid single quotes (PS strips them) |
| 6 | `gh repo edit --visibility public` failed ("accepts at most 1 arg") | Use `--visibility=public --accept-visibility-change-consequences` (= syntax) |
| 7 | Complex `--jq` filters failed in PowerShell (args split) | Use `--json ... \| ConvertFrom-Json` for complex queries; keep `--jq` to trivial one-liners |
| 8 | `Get-Date -AsUTC` doesn't exist in this PowerShell | `(Get-Date).ToUniversalTime()` |
| 9 | `loadKit()` silently drops missing GLBs → scenes missing objects | Asset gate (`check-assets.mjs`) before render + eyeball contact sheets after; never trust a clean exit alone |
| 10 | 2-machine baseline too slow (~32 min projected) | 20 machines + lowered `min-frames-per-chunk` → measured 10:15. Cancel slow runs early; runs are free on the public repo |
| 11 | `digest-mismatch: error` line in stitch logs looked fatal | Cosmetic GitHub artifact-download noise. Trust only the explicit `Frames in output: N (expected N)` verification |
| 12 | Chunk-boundary glitch risk (frame 224/225) | QA extracts boundary keyframes and the pop-detector flags discontinuities — measured run: seamless |
| 13 | Slow artifact download blocked the pipeline | §5: background download + Release-asset fast path |
| 14 | Pushing workflow after dispatch does nothing | `workflow_dispatch` reads the default branch AT DISPATCH — commit + push first, then run |
| 15 | Non-deterministic frames would corrupt chunk stitching | No unseeded randomness in compositions; identical frame number must render identically on any machine |
| 16 | npm/audio caches accidentally committed | `_cache/` gitignored; eyeball `git status` before every push (golden rule 4) |
| 17 | `gh release create --clobber` → `unknown flag` (release never created) | `--clobber` only exists on `gh release upload`. Keep create flag-free; fallback upload may use `--clobber`. Fixed in `fast-download` job |
| 18 | `fastdl.ps1` failed instantly: `"parallel x$Segments:"` = PowerShell parse error | In double-quoted strings, `$var:` parses as a scoped variable — write `${var}`. Same trap for any `$x:` inside `"` |
| 19 | Nested `powershell -File` printed conda profile errors | User's `profile.ps1` breaks under nested shells; invoke with `-NoProfile` |

---

## 7. COMMAND CHEAT SHEET

```powershell
# --- setup (once per machine) ---
cd E:\2026\EssouliAnas_animation_coldframe\render-repo\claude-animated-coldframe
powershell -File setup.ps1            # npm install + Kenney models into studio/public/bridge/kenney

# --- per video ---
node studio\scripts\check-assets.mjs  # from studio/: cd studio; node scripts/check-assets.mjs
#   craft gate (from studio/): npx tsx scripts/flow_selftest.ts ; npx tsx scripts/framing_selftest.ts
git add -A; git commit -m "..."; git push origin main
npx github:Razee4315/coldframe render <CompId> --chunks 20 --name <video>.mp4
#   or: gh workflow run coldframe.yml --repo burhan-ahmd/quiet-mill -f composition=<CompId> -f chunks=20 -f min-frames-per-chunk=20 -f output-name=<video>.mp4

# --- monitor / fetch ---
gh run watch <runId> --repo burhan-ahmd/quiet-mill --interval 15 --exit-status
gh run download <runId> --repo burhan-ahmd/quiet-mill --name <video> --dir ..\..\out\cloud
#   fast alt: scripts\fastdl.ps1 -Url <release asset URL> -Out ..\..\out\cloud\<video>.mp4
#   release listing: https://github.com/burhan-ahmd/quiet-mill/releases

# --- QA ---
ffprobe -v error -show_entries stream=nb_frames,r_frame_rate,width,height:format=duration -of default out\cloud\<video>.mp4
python studio\scripts\short_qa.py out\cloud\<video>.mp4 out\qa out\qa\<video>_shots.json
```

---

## 8. HONEST LIMITATIONS & UNTESTED PATHS

- **Voiceover + SRT mode** (§3 Step 5) is specified but not yet exercised end-to-end — validate on
  the first voiceover video (full cloud render + QA) before trusting it.
- **The `fast-download` release job** failed on its first live run (`gh release create --clobber`
  is not a valid flag — issue #17); the flag fix was pushed and the job has since **succeeded in a
  fully automated run** (run 43561667582, 2026-11-14: release `render-43561667582` published in 15 s,
  asset downloaded via curl in 19.7 s). If it ever fails again (it is `continue-on-error`), the
  artifact path still delivers — report it, don't ignore it.
- **Stragglers:** a single heavy shot section can dominate wall time; chunk sizes are uniform, not
  content-aware.
- **Remotion Lambda** would be faster still but costs money + AWS — deliberately not used.
- **Artifacts expire after 90 days**; release assets don't. Keep final MP4s locally under `out\cloud\`.
- **2025-frame `BridgeShort`** has not been cloud-rendered yet (needs its full soundtrack generated
  and wired first — `smoke-15s.wav` only covers the 15 s test).

*Last verified: 2026-11-14 — v2.2 craft layer adopted and validated end-to-end: run 43561667582
(ColdframeSmokeTest, 450/450 frames, QA all-green, boundary keyframes clean) with the CI craft gate
passing live ("all flow tests passed" + "all framing tests passed") and the release job publishing
automatically for the first time; delivery bake-off measured: artifact 149 s vs release 19.7-23.9 s
(SHA256-identical copies), release https://github.com/burhan-ahmd/quiet-mill/releases/tag/render-43561667582*
