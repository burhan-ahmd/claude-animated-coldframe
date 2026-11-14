---
name: cartoon-3d-short
description: Make a ~55-70 s vertical cartoon story short in the "2D characters in a colourful 3D world" style (flat bean-head cartoon cards with ink outlines, painted 3D town/world with black ink lines, saturated sky, depth-of-field backgrounds, gliding cameras, voice narration, synthesized SFX + march-style music), rendered with three.js inside Remotion. This repo renders in the CLOUD (GitHub Actions, 20 machines, no local rendering). v2 adds word-by-word captions, a funny viral story formula, framing/zoom/safe-area rules, per-place lighting (interior, night, sunrise) and a varied always-moving camera. Proven on "The Bridge That Fell for a Song" (2026-10-31). Use when the user asks for a viral fact short, a funny animated story short, or asks for another video "like the bridge video", "like the soldiers/bridge short", "in that cartoon 3D style", a history/science story short with cartoon characters in 3D, or says "use the cartoon short skill".
---

# Cartoon 3D story short (three.js + Remotion, cloud-rendered)

Proven example: **The Bridge That Fell for a Song**. It is an original 67 s short about the 1831 Broughton bridge and 74 soldiers marching in step.
- Code: `studio/src/videos/bridge/` (composition `BridgeShort`, 1080x1920, 30 fps).
- Script, voice and sound: `studio/shorts/bridge/` (SCRIPT.md, voice/, audio/).
- Style research: `references/` (STYLE_BIBLE.md, reports/*.md).

The style reference is a channel studied privately. The distilled study lives in `references/`:
STYLE_BIBLE.md, reports/*.md (the measured numbers), and `frames/` + `sheets/` — stills and contact
sheets of the reference shorts (committed from the upstream MIT repo, owner decision 2026-11-14, so
every agent can SEE the target style: read a few before building any new character or set, and make
side-by-side sheets against them). The studied channel's VIDEOS remain private material: never copy
their scripts, characters or shots — story, characters and voice are always OUR OWN — and never say
the channel's name in a voice-over or description.

**Pipeline law lives in `INSTRUCTIONS.md`** (cloud-only rendering, one public repo, fast delivery,
the 19-issue table). This file is the craft law: story, look, camera, captions. When the two
disagree about *rendering*, `INSTRUCTIONS.md` wins.

## How this repo differs from the upstream skill
- Everything renders on 20 free GitHub machines (`npx github:Razee4315/coldframe render <Comp> --chunks 20`).
  The local PC writes code and reads results; it never renders frames.
- New videos are new folders: copy `studio/src/videos/bridge/` to `studio/src/videos/<name>/`, register
  the composition in `studio/src/Root.tsx`, put script/voice/sound in `studio/shorts/<name>/`.
- Captions default to the locked house style (`Captions.tsx` in `bridge/`, same look as fredlorz).
- Craft files to reuse per video: `flow.ts` (continuous camera), `framing.ts` (safe-area checks),
  `Captions.tsx` (word captions). Their self-tests run in CI (`studio/scripts/*_selftest.ts`).

## User rules that apply
- Captions: ON by default for Shorts, word-by-word in the house style (see 'Subtitles'). Only leave
  them off if the user says so. No other on-screen labels.
- English only.
- Voice: one steady tone (deadpan: the narrator never reacts, the characters do).
- Jokes are researched real facts.
- Standard mix: music +3 dB, SFX -6 dB, voice unchanged.
- Delivery: the composition's own 1080x1920 vertical, h264, audio muxed in (the cloud workflow does this).
- Verify every check before claiming success; never claim untested success.
- "Just do it" once the script is approved.

## Pipeline
1. **Topic and facts.** Pick one surprising true story with a physical cause and effect (it should be visual), plus a simple everyday analogy that explains it.
   - Write the facts with their source at the top of `studio/shorts/<name>/SCRIPT.md`.
2. **Script** (~3.7 words/s, 35-70 s). For fact shorts use 'Viral story format' and 'Make it funny' below; the bridge beat formula is the alternative for disaster stories:
   - **Hook:** the absurd fact in one line ("Seventy-four soldiers knocked down an iron bridge just by walking across it.").
   - **Setting:** year, place, pride.
   - **Action:** escalation over three or four beats, each a little bigger.
   - **Snap:** the moment it breaks.
   - **Deadpan double line:** "Luckily ... / Unluckily ...".
   - **Explanation:** one physics idea through an everyday analogy (the kid on a swing).
   - **Consequence:** the rule it created.
   - **Callback twist:** the ending, shown as a held payoff beat (see 'Rules for every video', rule 4).
   - Never describe on screen what the viewer already sees.
3. **Voice.** Record or generate `voice.wav`/`voice.mp3`, then get its word timings into the project:
   - `studio/shorts/<name>/voice/words.json` in any STT shape (`normalizeWords` cleans it), or
   - the house pattern: a `words.ts` table built from measured onsets (see
     `studio/shorts/fredlorz/build_words.py` + `studio/src/videos/fredlorz/words.ts`).
   - Hand-fix the word timings. Everything is timed to them, and the captions are drawn from them too.
4. **Shot plan** in `story.ts`: copy `studio/src/videos/bridge/` to `studio/src/videos/<name>/`, register a new
   composition next to `BridgeShort` in `studio/src/Root.tsx`, and rename it.
   - `SHOTS`: id, a/b frames, light day/golden, crowd mode, `tau` story time.
   - `XFADE`: crossfades at place/time changes.
   - `FLASH_AT`: a white flash after the hook.
   - `CAMS`: per-shot keys `{f, dur?, cut?, s: f => {pos, look, fov, roll}}`.
   - `KICKS`: impact flip-shakes.
   - `DOF`/`dofAt`: lens blur per beat.
   - `FOREGROUND`: near framing props.
   - Every visual reaction lands 0-3 frames before its word.
   - Chain the subjects of each sentence into one continuous flow (`flow.ts`, see 'Continuous flow'), give
     every move a name and every stop a framing size (see 'Camera variety' and 'Framing').
   - Give every place its own light preset (see 'Lighting for every place').
   - Fill in `studio/templates/SHOT_PLAN_template.md` for every shot BEFORE building: camera flow, 3 depth
     layers, prop list, background characters, light preset, caption height, reactions and idle motion, and
     the ending beat. See 'Rules for every video'.
5. **World.**
   - `lights.ts`: LIGHTS plus the LOOK sky/river/cloud palette per light.
   - `shade.ts`: two-tone shading and `untone()`.
   - `build.ts`: town, houses and Kenney CC0 kit props, recoloured, with sight-line culling of anything blocking a camera.
   - `paint.ts`: HD Canvas2D painted textures with seams painted in as dark tints.
   - `world.ts`: sky shader, fog = horizon colour, river, per-frame posing, sun frozen per shot and camera-relative.
6. **Characters.**
   - `toon.ts`: the Canvas2D `Pen` drawing API, 600x1000 design canvas, soles at y = 975, bean heads, stick limbs, plum variable-width outline, face library.
   - `cast.ts`: camera-facing billboards, crowds, effect cards, blinks, walk cycles. All billboards go on the `NOINK` layer.
   - `cardshade.ts`: cards lit by the scene light, no emissive.
7. **Captions** (`Captions.tsx`, see 'Subtitles'): render `<Captions words={WORDS} />` as the LAST child of
   the composition, outside the post-processing composer.
8. **Post** (`<Name>.tsx` + `ink.ts` + `lensblur.ts` + `grade.ts`).
   - Composer order: ink → lens pre → lens main → bloom → NEUTRAL tone map → grade (MSAA 4).
   - Every pixel parameter scales with output height / 1920.
9. **Sound** (`studio/shorts/<name>/audio/`: timeline.py, sfx_gen.py, sfx.py, music.py, instruments.py, dsp.py, mix.py — copy the set from `studio/shorts/bridge/audio/`).
   - Event table → synthesized SFX plus an original score ducked under the voice.
   - Output: mix.wav (48 kHz, exact length), stems and cues.md. Commit the final mix so the cloud
     machines bundle it (`<Audio src={staticFile(...)} />` in the composition).
   - Lock the picture's time constants before the sound is made. Any later timing change means re-running the sound.
10. **Look checks (cloud-only).** First render a SHORT TEST CLIP in the cloud (a small test composition of
    the first shots — the `ColdframeSmokeTest` pattern), download the MP4 from the release asset, then
    locally extract keyframes with ffmpeg (extraction is not rendering) and run the Quality gate:
    `python studio/scripts/short_qa.py final.mp4 out/<name>/qa shots.json` plus one contact sheet per shot
    (first, middle, last frame). Fix, re-render the clip, and only then extend to the full story.
    - `node studio/scripts/bridge-stills.mjs <prefix> <frames> 0.5 <compId>` renders single stills locally
      (3-8 s each) — a debugging tool, not the default path; ask the user before using it (cloud-only rule).
    - Side-by-side sheets: `python studio/scripts/sbs_sheet.py out.jpg --ours ... --ref ...`.
11. **Final render (cloud).** See `INSTRUCTIONS.md` §3 for the exact commands:
    - commit + push FIRST (workflow_dispatch reads the default branch at dispatch), then
      `gh workflow run coldframe.yml -f composition=<Comp> -f chunks=20 -f output-name=<name>.mp4`.
    - 20 machines, wall ≈ `4 + (frames÷20)×7.8÷60` min; download from the release asset (fast path).
    - QA: `python studio/scripts/short_qa.py final.mp4 out/<name>/qa shots.json` (needs the system ffmpeg,
      not Remotion's minimal one) checks every frame for black, white, frozen and pop frames, plus loudness
      and sheets. Extract boundary keyframes, eyeball them, fix, re-render.
12. **Deliver.** MP4 lands in `out/cloud/` + the repo's GitHub Release; report the release URL.

## Preflight (do this first)
- Everything this skill needs is already IN this repo: `studio/src/videos/bridge/` (the proven look + the v2
  craft files `flow.ts`/`framing.ts`/`Captions.tsx`), `studio/templates/` (shot plan + script examples),
  `studio/scripts/` (stills, QA, self-tests), `references/` (style study). Nothing to clone. If something is
  missing, STOP and fetch it from github.com/alifmahmudashik/shorts-studio-skill — never improvise a
  generic three.js look without the templates.
- Make a 15 s test clip first (hook + 2-3 shots, with captions and sound), rendered IN THE CLOUD. Run the
  Quality gate on it, fix, then extend to the full story. Never go straight to a full render.

## Rules for every video (apply to ALL new shorts, whatever the topic)
These six rules came out of reviewing real renders. They are not about one story: apply them to every short and check them in the shot plan, not only at the end.
1. **No blank slabs.** No flat, unlit or single-colour surface (desk fronts, floors, walls, skies) fills more than 8 % of the frame. See 'Set dressing and real 3D depth'.
2. **Rich sets.** 12+ distinct props per place, 6+ in any wide shot, plus background characters in every interior and street. See 'Set dressing and real 3D depth'.
3. **Captions stay clear.** They never cover a face, a key prop or a bubble; each shot has its own caption height. See 'Subtitles'.
4. **A real ending.** The last shot is a held payoff or laugh (8-12 frames after the last word), and any named destination or sign is fully visible and readable. See 'Viral story format'.
5. **Nothing is frozen.** Blinks, sways, idle loops and prop wobbles, so no character is still for more than about 0.5 s. See 'Reactions and dialogue beats'.
6. **Real 3D depth.** 3 depth layers per shot, solid 3D props (not flat cards), at least two fly-through or pass-by camera moments, and a hero object seen from changing angles. See 'Set dressing and real 3D depth'.
Plan these per shot in the shot plan (`studio/templates/SHOT_PLAN_template.md`), then confirm each one in the Quality gate.

## Viral story format: "laugh at a genius" (use for fact shorts)
Six beats, every time:
1. **Weird action** with no context, shown in one picture (hook, first 3 s).
2. **The laugh:** the other characters mock the hero.
3. **They all look right:** time passes and the hero seems wrong or harmless.
4. **The clue:** one detail that foreshadows the payoff.
5. **The payoff:** the event that proves the hero right (the visual climax).
6. **The science:** show the mechanism (inside / cutaway / macro view) and explain it in one simple sentence.
- Tell it as a story with a hero, not a list of facts. Pick a weird practice that is visible in one image and that people would laugh at.
- The last line starts an argument or a comment (something debatable), not a neat summary.
- Title pattern: "Why X ...", "How X ...", "What the X really meant". No spoilers of the payoff in the title.
- Pacing: a new subject every 2-3 s, reached by camera travel (see 'Continuous flow') rather than a cut, with a sound effect on almost every move or dissolve (whoosh, clink, crowd laugh) and music under the voice.
- Rich places, simple characters (round heads, stick arms): plan 12-16 distinct places and 20+ props for a 60 s short, and give every place its own lighting mood.
- **Ending:** the last shot is a payoff, not a walk-away. Show the final twist or laugh (a face reaction, the callback gag) and hold it 8-12 frames after the last word. Any destination sign or location the last line names (a ship, a city, a station) must be fully inside the frame, large and readable, never cropped.
- Write the facts with sources first. Years and numbers are spoken naturally ("eighteen forty-seven") and captioned as digits.
- Example: `studio/templates/SCRIPT_viral_example.md`.

## Make it funny (comedy engine)
The crowd laughs at the hero; the viewer should laugh too.
- **Deadpan voice, absurd pictures.** The narrator never reacts; the characters do. The gap between the two is the joke.
- **A gag every 4-6 s**, using at least three kinds per short: a line gag (understatement, "Luckily ... / Unluckily ..."), a visual gag (reaction face, a tiny detail in the background, a wrong-scale prop) and a sound gag (a silly SFX that lands on the reaction).
- **Rule of three:** two normal beats, then the third breaks the pattern.
- **Running gag:** one background character or object (a pigeon, a man with a sandwich) shows up 3-4 times and gets a payoff near the end.
- **Reaction shots:** the camera settles on the face (a flow stop or a rack focus, not a cut) 3-6 frames after the punch word and holds 8-12 frames. Use the face library; include at least one "unimpressed" and one "shock". See 'Reactions and dialogue beats'.
- **Confident hero, smug crowd, over-serious officials:** characters take trivial things deadly seriously.
- **Exaggerate physics for one beat only** (the payoff): squash and stretch, a dust cloud, an impact kick.
- **Callback ending:** the last line twists the first line (the hook) using what happened.
- Jokes stay inside real facts: the funny part is the true detail. Never punch at real victims or at groups; the target is overconfidence and smugness.

## Subtitles (word-by-word captions)
- Source: the voice's word timings — `words.json` in any STT shape (`normalizeWords()` in
  `studio/src/videos/bridge/Captions.tsx` accepts `{word|text, start|start_time, end|end_time}` in seconds
  or milliseconds and skips ElevenLabs "spacing" entries), or the house `words.ts` table pattern
  (`studio/shorts/fredlorz/build_words.py`).
- If the speech-to-text text differs from the script (numbers, names, spelling), replace the text with the SCRIPT words and keep the STT times. Captions show the script spelling ("1847"), even though the voice says "eighteen forty-seven".
- Component: import `Captions` from `studio/src/videos/bridge/Captions.tsx` (copy it into the new video's
  folder if you need per-video tweaks) and render `<Captions words={WORDS} />` as the LAST child of the
  composition, as a DOM overlay above the three.js canvas, outside the post-processing composer (no ink,
  blur, bloom or grade on text).
- **Style: the locked house look** — Lilita One (committed at `studio/public/fonts/LilitaOne-Regular.ttf`,
  loaded through the FontFace API behind `delayRender` so no frame renders before it is ready), 176 px,
  off-white fill `#fbf7ef`, 13 px outline `#17161d` (`paintOrder: "stroke fill"`), hard offset shadow
  `0 10px 0 rgba(23,22,29,0.28)` (no blur), `letterSpacing: -0.01em`, one word at a time, horizontally
  centred at 75.52 % of the frame height (1450 px at 1920 — below faces, above the platform UI strips),
  and a 5-frame pop (small overshoot + 16 px rise). Pixel sizes scale with output height / 1920.
- Never cover a face: when a close-up has the face at the caption position, pass `yPercent={(frame) => ...}`
  to move it for that shot.
- Captions must never overlap a face, a hand-held or key prop (briefcase, envelope, sign) or a speech
  bubble. Keep a per-shot caption height list (`CAPTION_Y`, next to `CAMS` in `story.ts`; default 75.5,
  move it when the subject sits there) and pass it to `<Captions yPercent={...} />`. Check it on the still
  of every punch word and fix any collision before rendering.
- The caption appears 1 frame before its word is heard (`lead`).
- The upstream accent colour (numbers/names in gold) is available via `highlight` but OFF by default — the
  house style locks the fill to off-white; only turn it on if the user asks.
- QA: render a still on a punch word in every shot and confirm the caption is inside the safe area and does not cover a face.

## Framing, safe area and zoom limits (enforced)
- 9:16 frame. Safe area: 6 % margin left/right, 8 % top, 15 % bottom (platform UI and captions). Everything that matters (characters, props, bubbles, signs) is fully inside it, except deliberate foreground framing props.
- A character's head takes at most 30 % of the frame height (a one-shot reaction gag may use 40 %). Prefer medium shots (waist up) and full-body wides.
- Never cut a character off at the feet, and never crop a speech bubble or sign. A foreground prop is either recognisable or gone; a cut-off prop must not cover more than 35 % of the frame.
- No more than two shots of the same size in a row (wide / medium / close / insert).
- Push-ins on holds stay slow: 0.15-0.35 % per frame, 0.6 % on punch words. No sudden big zooms.
- Automatic check: `checkShot(camera, items)` in `studio/src/videos/bridge/framing.ts` projects bounding
  boxes to screen space and lists every problem. Run it on the first, middle and last frame of every shot,
  and fix failing shots before rendering. Self-test: `npx tsx studio/scripts/framing_selftest.ts`
  (it also runs in the CI craft gate).

## Set dressing and real 3D depth (minimums for every place)
The look is "2D characters in a real 3D world". A shot that reads as a flat backdrop with two cutouts is a failed shot.
- **Layers:** every shot has at least 3 depth layers: foreground (a pillar, chair back, lamp, plant, railing, hanging sign), midground (the characters and their props) and background (set pieces, windows, a street, people). Never a character against one flat wall.
- **Real 3D props, not flat cards:** props are solid shapes with thickness, rounded edges and lit, shadowed faces: chairs, tables with legs, lamps, chandeliers, curtains with folds, rugs, columns, crates, suitcases, cannons, ships. A sign or picture has a frame with depth. Use flat planes only for paper, posters and distant skylines.
- **Counts:** at least 12 distinct props visible across each place, and at least 6 in any single wide shot. Add background life: 2-4 extra characters or silhouettes in every interior and street (waiters, passers-by, pigeons, guards), each with a small idle motion.
- **No blank surfaces:** no flat, unlit or single-colour surface may fill more than 8 % of the frame (desk fronts, floors, walls, skies). Every table front, wall and floor gets a texture or pattern, trim or baseboard, a lit edge, a contact shadow and a gradient. Empty floor never takes more than 25 % of a wide shot: fill it with a rug, furniture or people.
- **Parallax from the camera:** the camera moves THROUGH the set, so foreground objects slide past the lens, midground turns slowly and the background barely moves. Use at least two fly-through or pass-by moments per short (past a pillar, under an arch, through a window or doorway, over a table).
- **Light that has volume:** window light shafts with dust, lamp glow with bloom, a cast shadow from every prop, a contact shadow under every character. See 'Lighting for every place'.
- **Show the world in 3D when it matters:** the hero object (a tower, ship, bridge, machine) is a full 3D model seen from a changing angle (low, high, three-quarter), not always straight on.
- **Check:** one still per shot and answer yes/no: 3 layers? 6+ props? any blank slab over 8 %? Fix every "no" before the full render.

## Lighting for every place (the bridge only defines day and golden)
Every place needs its own light preset in `lights.ts`: a clear key direction, two-tone shading (warm lit, cool shade), cast and contact shadows, and a matching sky or ceiling. Never a flat unlit room, and never sky or clouds visible inside a room.
- **Interior (hall, hotel, office):** a ceiling or dark wall top, one key light from a window or lamp, warm practical lights (candles, lamps) with bloom, a cool shade side, a soft vignette, floor and wall shadows from every prop, light shafts or dust from windows.
- **Night:** moonlit blue key (about #5b7fd6), deep blue-violet shade, warm lit windows and lamps as contrast, moon disc or stars.
- **Sunrise / sunset:** low sun with god rays, peach to pink sky, violet shade, long shadows.
- These are starting values: tune them against the look targets below (the measured numbers in
  'Final look values' and 'Look targets').
- Contact shadow under every character and prop, plus a directional shadow tail from the key light; furniture and props cast shadows on floors and walls (card shadows are real, not blobs, in interiors).
- Depth of field (table below) is applied consistently: close-ups and medium shots are never fully sharp, wides stay sharp.

## Camera variety (always moving, never the same move twice in a row)
- Within a flow or shot, use named moves: slow push-in, pull-back reveal, orbit around the subject, lateral track with parallax, crane up/down, tilt, rack focus from a foreground prop to the subject, small dutch roll (4-5°).
- No two consecutive moves are the same.
- Put foreground props (pillars, rails, furniture) between the lens and the subject in about a third of the shots, so camera motion reads as depth.
- At least two insert shots per story: a macro or cutaway of the mechanism for beats 4-6, plus one dramatic angle (low hero angle or bird's eye).
- Keep the existing smootherstep glides (18-40 f), creeping holds and impact kicks.

## Continuous flow: travel between subjects, don't cut (the signature move)
Everything else is the camera travelling through ONE world from subject to subject, plus short dissolves
(3-8 frames) when the place or time changes, and travels through windows and doors that hide the change.
Cutting to a separate shot for every subject (tower, then the people, then a face) looks cheap.
- **Same place, no cut.** "Paris was broke": start wide on the Eiffel Tower, then travel down (tilt, dolly) to the crowd at its foot, then settle on one worried face, in one unbroken move while the voice says the line. Tower → crowd → face is a chain of three stops in one flow.
- **Build the set for it.** Subjects that share a sentence live in the same 3D space: the crowd stands at the tower's foot and the hero is among them. Do not build a separate set for each shot.
- **Settle, then go.** Each stop is a framing of the subject (wide / medium / close, see Framing) held for 20+ frames with a creeping push-in (0.15-0.35 %/f, `push`). Travel between stops takes 18-60 frames (`checkFlow` warns outside 18-75), on a curved path with ease in and out.
- **Timing to the voice.** The camera arrives on the subject 0-3 frames before the word that names it. Travel happens on the connecting words or in the pause; stops land on the nouns and punch words.
- **Rack focus follows.** The focus point travels with the camera (`flowFocus`), sharp on the new subject 4 frames before the camera settles.
- **Scale jumps are travel too.** Pull from a macro (a hand, a coin, a dragon's mouth) out to the hero and the town, or push from the town into one object that becomes the next scene.
- **Place or time change:** a 3-8 frame dissolve (`XFADE`), or hide the change in the move itself: travel through a train window into the car, tilt up into the sky and back down into the next place, pass behind a wall or a prop.
- **Hard cuts** are only for a gag or an impact, about once per 30-60 s.
- **Budget:** 4-6 flows per 60 s story, each 4-10 s long and chaining 2-4 subjects; at least 60 % of the screen time is inside a flow.
- **How:** `studio/src/videos/bridge/flow.ts`. A flow is ONE key in `CAMS` (`{f: start, cut: true, s: flow(stops)}`), `flowFocus(stops)` feeds `DOF`, `lookFrom(target, dist, azimuth, elevation)` places a camera around a subject, `checkFlow(stops)` lists problems. Self-test: `npx tsx studio/scripts/flow_selftest.ts`. Run the framing check (`framing.ts`) on every stop.

```ts
import {flow, flowFocus, lookFrom, Stop} from './flow';
const TOWER = lookFrom([0, 150, 0], 160, 20, 8);   // wide of the tower
const CROWD = lookFrom([6, 1.4, 12], 5, -25, 4);   // the broke people at its foot
const HERO  = lookFrom([8, 1.5, 12.5], 2.2, -10, 2);
const stops = [
  {f: 0,   ...TOWER, hold: 20, focus: [0, 150, 0]},
  {f: 58,  ...CROWD, hold: 24, focus: [6, 1.2, 12]},
  {f: 118, ...HERO,  hold: 30, focus: [8, 1.6, 12.5]},
];
CAMS[3] = [{f: 0, cut: true, s: flow(stops)}];
```

## Reactions and dialogue beats (light touch, no lip-sync, one narrator voice)
Characters do not talk with moving lips and there is no second voice. The narrator reads the line, and the characters sell it with their faces. This uses the existing face library in `toon.ts` (neutral, stern, grin, laugh, whistle, nervous, shock, relief, dazed, pained, smile, lick); do not add new drawing code unless a reaction is truly missing (then add one `Expr` entry to the `FACE` table).
- **Reaction faces (mouth and eyes together):**
  - laugh → `laugh` + crowd-laugh SFX
  - shock / gasp → `shock` + gasp or record-scratch
  - nervous → `nervous` + gulp
  - dazed after an impact → `dazed` + ding
  - hurt → `pained`
  - smug → `smile` or `grin`
  - guilty or innocent → `whistle`
  - unimpressed → `stern` or `neutral`, held 12 f
- **Life between beats (secondary motion):** no character is frozen for more than about 0.5 s. Add blinks every 2-4 s, small head bobs and sways, breathing squash, an idle hand or foot shift, and prop wobbles (a bell, a hat brim, a hanging sign). Background characters get their own loops. Reaction faces still land on their beats; the idles sit under them.
- **Timing:** the expression changes 0-3 frames before the word it reacts to, using a blink to hide the swap (as in `cast.ts`). The reaction holds 8-12 frames, then eases to the next expression. Never stay on one face for a whole line.
- **Dialogue beat (optional, at most 2 per short, one line of 8 words or fewer each):**
  1. The narrator reads the quoted line in the same deadpan voice: `"Is this legal?" the dealer asked. "Very," said the con man.` Captions use the same style.
  2. The speaker is a flow stop: settle on them while the line is read (20+ frames, creeping push-in).
  3. A silent beat of 6-10 frames with a creep, no new sound.
  4. The camera travels or rack-focuses to the listener (flow stop or `flowFocus`), and their face lands 3-6 frames after the last word.
  5. Hold the reaction 8-12 frames with a small SFX, then continue the flow.
- **Camera for dialogue stays inside the flow rules:** speaker and listener are two stops (a close two-shot, an over-the-shoulder, or an orbit between them), never a pair of separate cut shots. The only cut allowed is one smash cut to a reaction for the biggest gag of the short, and it counts toward the hard-cut budget (about one per 40 s).
- **Extras that fit the same rules:** double take (face looks away, then back with `shock`), punch-in on the last word (0.6 %/f for 35 f), freeze for 6 f with a record-scratch, a bystander's face in the background reacting a beat late.
- If real lip movement or a second voice is wanted later, add it as its own feature; the default is narrator-only.

## Quality gate (before every full render)
1. Framing check passes for every shot and every flow stop (`framing.ts`). Hard cuts are at most 2 per 60 s, every subject change inside one place is a flow (`checkFlow` has no warnings), and the flows cover at least 60 % of the screen time. Both self-tests pass (`npx tsx studio/scripts/flow_selftest.ts` and `framing_selftest.ts`).
2. One contact sheet with a still per shot (first, middle, last frame), cut from the cloud-rendered test clip and compared side by side against `references/frames/` + `references/sheets/`.
3. Score lighting, shadows, blur, framing, zoom, camera variety, captions, gags and 3D depth out of 10. Fix anything below 8 and re-render the affected shots.
   - 3D depth and set dressing: every shot has 3 depth layers, 6+ props in wides, background life in interiors and streets, and no blank surface over 8 % of the frame (see 'Set dressing and real 3D depth').
   - Captions: none overlaps a face, a key prop or a bubble.
   - Ending: the last shot holds a payoff beat, and any named destination sign is fully visible and readable.
   - Life: no character is frozen for more than about 0.5 s.
4. Every gag has a reaction face that changes 0-3 f before its word. Voice 20 dB above music; numbers spoken naturally; captions match the script; a sound on almost every cut.
5. Only then dispatch the full cloud render (`INSTRUCTIONS.md` §3) and run `short_qa.py` on the MP4.

## Final look values (bridge after 4 verifier rounds; all live in `studio/src/videos/bridge/`)
Start every new short from `studio/src/videos/bridge/` (copy to `studio/src/videos/<name>/`): the look lives in these
values, the story lives in story.ts / build.ts layout / cast.ts roles. Verifier scores at the end: colour day 7,
golden 5-6, lighting 5-6, ink 6, textures 5-6, characters 7, depth 6-7, composition 6-7.
- **Light presets** (`lights.ts`, sun camera-relative and frozen per shot):
  - day: az 75 / el 48, lit [1.58,1.5,1.33], shade [.30,.29,.36], lift [.05,.06,.11] (cool tint ONLY in shade), sky
    top #3e7fd2 → horizon #b8d0ec, fog = horizon, 25→300 m, uSat 1.08, ~15 % blue haze past 60 m.
  - golden: az 6 / el 7 (backlit low sun), key toward #FFB36B ×1.5, violet-blue shade (facade ≈ #444380), sky
    #ffc47c → #8a6f8a, peach fog only past 50 m, sun disc #ffcf9e + bloom, contact blobs + real card shadows.
- **Albedos** (`paint.ts`/`build.ts`): muted brick / cream / ochre / terracotta houses with plinth, cornice, sills,
  hoods, door step, chimney + pot, heights 7 / 8.4 / 9.8 m; warm grey/beige stone (saturation −35 % from "storybook");
  ochre wood deck C* ~51-58 with near-black seams; iron dark and desaturated. Never lemon, never lavender lit faces.
- **Ink** (`ink.ts`): #030303, 5.1 px near (6 m) → 3.3 px far (90 m) at 1080x1920, creases ×0.8 from 35°, depth
  jumps from 1 %, fog tint 0.3 only far; character cards on layer `NOINK` (they carry their own plum ink).
- **Lens** (`lensblur.ts` + `dofAt` in story.ts): cInf px at 1080: hook/river CU 15-16, close-ups 12-14, MS 10-12,
  park 7, golden sway 5, wides/aerials 0. Focus on the eyes of the front row.
- **Post** (`Bridge.tsx`): ink → lens pre → lens main → bloom (thr 1.0, int .5, 6 levels, radius .6) → NEUTRAL tone
  map → grade; MSAA 4. Film grain exists but is OFF (reference measures no grain; it quadruples the file size).
- **Characters** (`toon.ts`/`cast.ts`/`cardshade.ts`): bean heads h/w .94, plum ink #241726, eyes .26 W apart, no blush,
  14 expressions; adults 3.5 head-heights; walk bob 5 %, lean 1-7°, planted 0.8 m stride; blinks 0.5-2.3 s; tight
  contact shadow ~.5 under the feet + sun-direction tail by day; golden rim inner only (never an offset outer copy).
- **Camera** (`story.ts`): continuous flows between subjects (`flow.ts`, see 'Continuous flow') instead of cuts, short dissolves at place changes, hard cuts only for a gag or impact, smootherstep glides 18-40 f, every hold creeps (no static hold ≥4 f),
  flip kicks decaying over 7 f on impacts, 4-4.6° rolls, foreground props (`FOREGROUND`) in ~1/3 of shots.

## Look targets (measured from the reference; see references/reports/)
- **Ink:**
  - World lines: about 3 px at 1080 wide, near-black #0b0a0c, nearly constant with distance. Silhouettes, depth jumps and normal creases only. No line on wall/floor joins or the horizon. Character cards are never outlined by the world ink.
  - Character ink: dark plum #201628-#2f1d28, thicker on the bottom/shadow side.
- **Colour:**
  - Day median luma ~.57. Non-ink p5 ~.23 (no crushed blacks). Lit chroma C* p90 ~55. Day sky top ~#5e93d9, horizon 1.28x brighter.
  - Golden: peach horizon #ffd08a, violet-blue shadows (never brown), backlit sun.
- **Depth:**
  - DOF on about 1/3 of screen time (CU, MS, inserts), cInf 10-16 px at 1080, focus on the eyes. Establishing and wide shots stay sharp.
  - Fog = horizon colour, 25→420 m day, 20→360 m golden.
  - Bloom only on HDR emissives: threshold 1.0.
- **Camera:**
  - Subject changes inside one place are continuous flows (`flow.ts`); place or time changes are a 3-8 f dissolve (`XFADE`) or a travel through a window, door or sky; a hard cut is rare (about one per 40 s). Small reframes are a smootherstep glide of 18-40 f, peak ≤ 25 px/f at 720p.
  - Every hold pushes in 0.15-0.35 %/f, with 0.6 %/f on punch words.
  - Rolls of 4-5°.
  - No hand-held float. Impact shakes flip sign every frame and decay over 7 f.
- **Characters:**
  - About 3.5 head-heights tall, legs 1.4 HH.
  - Stick limbs about 0.055 of head width, ink-dot hands.
  - Bean head (h/w ~0.93, narrower chin, pointier crown).
  - No blush or eye highlights. Faces at brightness ~.93.
  - Walk bob 3-7 %, lean 1-7°, planted feet.
  - Blinks every 0.5-2.3 s, lasting 4 f.

## Look-match loop (only for making a NEW style match something; skip it for new stories in this style)
The proven bridge look is already in the repo — new videos copy it and tell new stories. Use this loop only
when the user asks for a different look. It needs local still renders (`bridge-stills.mjs`), so ask the user
before starting it (cloud-only rule).
1. **Measure the reference first.** One analysis agent per topic (motion, depth, textures, characters, lighting, outlines, grade), each writing numbers, not adjectives, to `references/reports/<topic>.md`. Shared brief: `references/reports/CONTEXT.md`. Reports are the source of truth for every agent after.
2. **Sandboxes, one owner per file.** Copy the video folder to `studio/src/videos/<name>_{cam,world,mat,char,post}`. Ownership: cam = story.ts; world = world.ts/lights.ts/shade.ts/grade.ts; mat = paint.ts/build.ts; char = toon.ts/cast.ts/cardshade.ts; post = ink.ts/<Name>.tsx/lensblur.ts. Agents only edit their own files and render stills with `BRIDGE_ENTRY=studio/src/sandboxes/<n>/index.tsx node studio/scripts/bridge-stills.mjs out/<name>/<n>/x_ <frames> 0.5 <compId>`.
3. **Merge** with `python studio/scripts/bridge_merge.py [cam,world,mat,char,post]` (backs main up to `backup/bridge_<time>/`, copies owned files only). Then `npx tsc --noEmit` (run inside `studio/`), then re-sync every sandbox from main before the next round.
4. **Verify** with a fresh reviewer: side-by-side sheets (`python studio/scripts/sbs_sheet.py out.jpg --ours a b --ref r1 r2`), score each area out of 10 (colour day / golden, lighting, ink, textures, characters, depth, composition) plus a numbered fix list with frame numbers. Map each fix to the file owner and resume that owner's agent.
5. Contracts between owners live in exported constants (e.g. `NOINK` layer from ink.ts, `dofAt`/`FOREGROUND` from story.ts, `LIGHTS`/`LOOK` from lights.ts). Changing a contract means telling every owner that reads it.

## Gotchas
- Kenney nature-kit materials are teal: recolour them by material name in build.ts.
- Cameras end up inside houses: the sight-line culler in build.ts/world.ts removes anything blocking any camera ray.
- Ink in the same merged effect pass as DOF gets overwritten. Ink must be its own pass before the blur.
- Pixel-sized post parameters must scale with resolution: every px value is multiplied by height / 1920.
- Remotion writes a silent audio track: the cloud workflow muxes the committed audio back in (`-map 0:v:0 -map 1:a:0`). Commit the mix under `studio/public/audio/` (or the video folder's public path) BEFORE dispatching, or the MP4 ships silent.
- In JS strings write `"E:/2026/..."`, never `"E:\2026\..."` (`\r` becomes a carriage return).
- Cloud: push before dispatch — `workflow_dispatch` reads the default branch AT DISPATCH (INSTRUCTIONS.md issue #14). A workflow edit must be committed first.
- Cloud: Remotion's bundled ffmpeg is minimal (no filters, no ebur128) — run `short_qa.py` with the system ffmpeg; Remotion's `ffprobe.exe` is fine for probing.
- Cloud: download the MP4 from the GitHub Release asset (fast, permanent), not the artifact API (slow) — see INSTRUCTIONS.md §3.
- Sub-agents can't write report files in this harness: ask them for a ≤150-word final message and save it yourself.
- Scratch `.ts` files inside `out/` break `tsc`: name them `.txt`.

## Readability traps the verifier caught (check every new prop/shot for these)
- **A swing drawn as one rope that disappears behind the kid reads as a HANGING.** Always two ropes to a wide plank
  with the kid between them (`swingKid` in toon.ts), and a frame whose legs clear the arc (A-frame at each end).
- Props or flotsam closer than ~2 m to a lens become huge cut-off blobs at the frame edge. When a camera moves, re-check
  every prop near its new position (the river cameras moved into the floating hats).
- A foreground bush cut by the frame edge reads as a "green ball"; a foreground prop must be recognisable or gone.
- Flags: red + yellow star/diamond reads as Vietnam's. Use a period-correct flag (St George's cross for England 1831).
- Painted signs lit by a side sun go grey-blue and unreadable: give the sign face an unlit material.
- Golden rim light done as an offset outer copy turns every hat into a picture frame: inner rim only, head/torso only.
- Balcony/railing rails at chest height through characters: put the lens ~2.5 m up so rails cross legs, not torsos.
- Flat holds read as freezes in QA (frozen span ≥12 f): every hold needs a creeping push-in.
