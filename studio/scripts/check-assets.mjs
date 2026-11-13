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

const missing = KENNEY.filter((n) => !fs.existsSync(path.join(out, `${n}.glb`)));
if (!fs.existsSync(tex)) missing.push("Textures/colormap.png");
if (!fs.existsSync(wav)) missing.push("public/audio/smoke-15s.wav");
if (missing.length) {
  console.error(`MISSING ASSETS (${missing.length}):\n  ` + missing.join("\n  "));
  console.error("Run `npm run models` (needs network) and `python shorts/bridge/audio/smoke_audio.py` locally, then commit.");
  process.exit(1);
}
console.log(`assets ok: ${KENNEY.length} Kenney models + colormap.png + smoke-15s.wav (${(fs.statSync(wav).size / 1e6).toFixed(1)} MB)`);
