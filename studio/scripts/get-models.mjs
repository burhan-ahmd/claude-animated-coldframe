// usage: node scripts/get-models.mjs
// Downloads the two free Kenney CC0 kits the bridge template uses (Nature Kit + Fantasy Town Kit) and copies the
// .glb models it loads into public/bridge/kenney/. Safe to run again: models already there are skipped.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const OUT = path.resolve("public/bridge/kenney");
const KITS = ["nature-kit", "fantasy-town-kit"];
// the names world.ts loads (KENNEY list); anything missing renders without that prop
const NEED = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree_cone", "tree-high-round", "tree", "plant_bushLarge", "plant_bushDetailed",
  "plant_bush", "hedge", "flower_redA", "flower_yellowA", "flower_purpleA", "grass_large", "grass", "lily_large", "lantern", "cart", "stall-red",
  "stall-green", "stall-bench", "banner-red", "banner-green", "windmill", "canoe"];

fs.mkdirSync(OUT, { recursive: true });
// Fantasy Town models read their colours from Textures/colormap.png next to the .glb
const TEX = path.join(OUT, "Textures", "colormap.png");
const missing = () => NEED.filter((n) => !fs.existsSync(path.join(OUT, `${n}.glb`))).concat(fs.existsSync(TEX) ? [] : ["colormap"]);
if (!missing().length) { console.log("all", NEED.length, "models already in", OUT); process.exit(0); }

const UA = { "User-Agent": "Mozilla/5.0 (claude-animated-shorts setup)" };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kenney-"));

// kenney.nl hands out a signed link per kit: open the page (sets a session cookie), then ask for the link
const download = async (kit) => {
  const page = `https://kenney.nl/assets/${kit}`;
  const res = await fetch(page, { headers: UA });
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const id = Buffer.from(`assets/${kit}`).toString("hex");
  const link = await (await fetch(`https://kenney.nl/download-link/${id}`, { headers: { ...UA, Cookie: cookie, Referer: page } })).json();
  if (!link.url) throw new Error(`no download link for ${kit} (${JSON.stringify(link)}): download it by hand from ${page}`);
  const zip = path.join(tmp, `${kit}.zip`);
  fs.writeFileSync(zip, Buffer.from(await (await fetch(link.url, { headers: { ...UA, Cookie: cookie, Referer: page } })).arrayBuffer()));
  console.log("downloaded", kit, (fs.statSync(zip).size / 1e6).toFixed(1), "MB");
  return zip;
};

// Windows 10+ and macOS ship bsdtar, which reads zips; Linux falls back to unzip
const unzip = (zip, dir) => {
  fs.mkdirSync(dir, { recursive: true });
  try { execFileSync("tar", ["-xf", zip, "-C", dir], { stdio: "ignore" }); }
  catch { execFileSync("unzip", ["-q", "-o", zip, "-d", dir], { stdio: "ignore" }); }
};

const glbs = new Map(); // model name -> path inside the extracted kits
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else if (e.name.endsWith(".glb") && !glbs.has(e.name.slice(0, -4))) glbs.set(e.name.slice(0, -4), p);
  else if (e.name === "colormap.png" && path.basename(d) === "Textures" && /GLB/i.test(p) && !glbs.has("colormap")) glbs.set("colormap", p);
} };

for (const kit of KITS) { const dir = path.join(tmp, kit); unzip(await download(kit), dir); walk(dir); }
let n = 0;
for (const name of missing()) {
  const src = glbs.get(name);
  if (!src) { console.log("not found in the kits:", name); continue; }
  if (name === "colormap") { fs.mkdirSync(path.dirname(TEX), { recursive: true }); fs.copyFileSync(src, TEX); } else fs.copyFileSync(src, path.join(OUT, `${name}.glb`));
  n++;
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`copied ${n} models to ${OUT}`);
