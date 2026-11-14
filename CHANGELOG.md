# Changelog

## v2.2
- The `new-video` orchestrator skill moved to its own repo: https://github.com/alifmahmudashik/new-video-skill

## v2.1
- **Set dressing and real 3D depth:** every shot needs 3 depth layers, solid 3D props (not flat cards), 6+ props in wides, background characters in interiors and streets, and no blank surface over 8 % of the frame. At least two fly-through moments per short.
- **Caption collisions:** captions never cover a face, key prop or bubble; per-shot `yPercent` check on every punch word.
- **Ending rule:** the last shot is a payoff beat held 8-12 frames, and any named destination sign is fully readable.
- **Life between beats:** blinks, sways, idle loops and prop wobbles so nothing is frozen for more than about 0.5 s.
- Quality gate extended with the checks above.
- **General rules:** a 'Rules for every video' section (six rules) plus `templates/SHOT_PLAN_template.md`, so every new short plans these per shot, not only at the end. Nothing here is specific to one story.

## v2.0 (viral + funny update)
- **Subtitles:** `templates/bridge/Captions.tsx`, word-by-word captions driven by `words.json` (accepts seconds or milliseconds, ElevenLabs/Whisper-style fields). Captions are now ON by default.
- **Viral story format:** the six-beat "laugh at a genius" structure, title patterns, comment-bait endings and pacing rules.
- **Make it funny:** a comedy engine (deadpan voice, gag every 4-6 s, rule of three, running gag, reaction-shot timing, callback ending).
- **Continuous flow:** `templates/bridge/flow.ts` builds one unbroken camera move through several subjects (spline path, settle-and-creep holds, rack focus, `checkFlow`), with a self-test. Replaces the old rule that big reframes are hard cuts; hard cuts are now rare and dissolves handle place changes.
- **Reactions and dialogue beats:** reaction-face mapping (laugh, shock, nervous, dazed, smug ...) with SFX and timing, plus an optional narrator-read dialogue beat that stays inside the continuous-flow rules. No lip-sync and no second voice.
- **Framing:** safe-area margins, max head size, no cut-off props, shot-size variety, plus `templates/bridge/framing.ts` and `templates/scripts/framing_selftest.ts` and `flow_selftest.ts`.
- **Lighting for every place:** rules and starting presets for interiors, night and sunrise, plus shadow rules.
- **Camera variety:** named moves per shot, parallax foreground, macro cutaways, dramatic angles.
- **Quality gate** and **Preflight** (test clip first, contact sheet per shot).
- New example: `templates/SCRIPT_viral_example.md`.

## v1.0
- Original release by mromidev: the bridge short pipeline, templates, audio and reference reports.
