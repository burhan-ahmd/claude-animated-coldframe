// usage: node scripts/check-assets.mjs  (run from studio/)
// Cloud-render gate: fails loudly if any 3D model, texture or soundtrack the Remotion bundle needs
// is missing from the repo tree, BEFORE any render minutes are spent. world.ts loads models from
// public/bridge/kenney/<name>.glb and DROPS missing ones silently (a .catch per model), so a
// missing asset would only show as an invisible prop - this check makes it an error instead.
// Keep KENNEY in sync with KENNEY in src/videos/bridge/world.ts.
import fs from "node:fs";
import path from "node:path";

const KENNEY = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree_cone", "tree-high-round", "tree", "plant_bushLarge", "plant_bushDetailed",
  "plant_bush", "hedge", "flower_redA", "flower_yellowA", "flower_purpleA", "grass_large", "grass", "lily_large", "lantern", "cart", "stall-red",
  "stall-green", "stall-bench", "banner-red", "banner-green", "windmill", "canoe"];

const out = path.resolve("public/bridge/kenney");
const tex = path.join(out, "Textures", "colormap.png"); // Fantasy Town models read their colours from this
const wav = path.resolve("public/audio/smoke-15s.wav");
const fredWav = path.resolve("public/audio/fredlorz.wav");            // "Fred Lorz, 1904" mixed soundtrack
const fredVoice = path.resolve("public/audio/fredlorz-voice.mp3");    // its narration, for provenance
const tramWav = path.resolve("public/audio/tram-15s.wav");            // "The Last Tram, 1902" mixed soundtrack
const fredFont = path.resolve("public/fonts/LilitaOne-Regular.ttf");  // word-synced captions (words.ts/captions.tsx)

const missing = KENNEY.filter((n) => !fs.existsSync(path.join(out, `${n}.glb`)));
if (!fs.existsSync(tex)) missing.push("Textures/colormap.png");
if (!fs.existsSync(wav)) missing.push("public/audio/smoke-15s.wav");
if (!fs.existsSync(fredWav)) missing.push("public/audio/fredlorz.wav");
if (!fs.existsSync(fredVoice)) missing.push("public/audio/fredlorz-voice.mp3");
if (!fs.existsSync(tramWav)) missing.push("public/audio/tram-15s.wav");
if (!fs.existsSync(fredFont)) missing.push("public/fonts/LilitaOne-Regular.ttf");
if (missing.length) {
  console.error(`MISSING ASSETS (${missing.length}):\n  ` + missing.join("\n  "));
  console.error("Run `npm run models` (needs network), `python shorts/bridge/audio/smoke_audio.py` and `python shorts/fredlorz/audio/fredlorz_audio.py` locally, then commit.");
  process.exit(1);
}
console.log(`assets ok: ${KENNEY.length} Kenney models + colormap.png + smoke-15s.wav (${(fs.statSync(wav).size / 1e6).toFixed(1)} MB) + fredlorz.wav (${(fs.statSync(fredWav).size / 1e6).toFixed(1)} MB) + tram-15s.wav (${(fs.statSync(tramWav).size / 1e6).toFixed(1)} MB) + LilitaOne-Regular.ttf (${(fs.statSync(fredFont).size / 1e3).toFixed(0)} kB)`);
