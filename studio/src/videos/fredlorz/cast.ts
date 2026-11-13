// The cast of "The Man Who Rode to Victory" as lit flat sprites in the 3D world. Each frame every character asks for
// a drawing (a key + a draw call); the pool keeps one canvas per distinct drawing, so the 36 seated grandstand
// townsfolk (6 outfits x 7 head shapes) share canvases. Characters are yaw-only billboards shaded by cardShade()
// (scene tint, bright floor, side gradient toward the sun, painted crescent in the drawing); standing ones get a
// soft multiply contact blob. Effects are unlit cards. Cards, effects and blobs live on the NOINK layer so the
// world ink pass never outlines their quads.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, townsfolk, KID, PARENT, fxPuff, fxBurst, fxStars, fxContact, fxShadow, Outfit, Expr,
  FrontOpts, SideOpts,
} from "../bridge/toon";
import {
  FPS, TAPE_X, BREAK1, BREAK2, GRAND, grandTier, carX, carSpeed, engineHz, fredX, fredZ, fredY, fredMode, fredExpr,
  fredSpeed, gaitHz, phaseAt, stride, clamp01, smooth, V3,
} from "./story";
import { LIGHTS } from "../bridge/lights";
import { NOINK } from "../bridge/ink";
import { cardShade, blobMaterial, CARD_K } from "../bridge/cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  in the golden light. Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, exhaust) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false;
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    } else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (world.ts passes it; the fallback is only for safety) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
/** head-shape seed: 7 shapes, so the seated crowd still shares canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design] */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};
/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
const LID = [0.5, 1, 1, 0.5];
/** the words that carry a reaction in this film (measured in new_story/word.txt): "rides", "car", "tape", "caught" */
const SWAPS: Record<number, number[]> = { 2: [5.98], 5: [17.07], 6: [21.6], 8: [25.2] };
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a card: a TIGHT contact pool right under the feet, plus by day (cards cast no real shadow) a
 *  lighter soft tail stretched AWAY from the sun. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h;
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- wardrobes ----------------
const SKINS = ["#ffe2c2", "#f5c9a0", "#ecd0b6", "#c99067"];
/** Fred: off-white singlet and dark shorts, street shoes, no hat */
export const FRED: Outfit = { jacket: "#efe7d6", pants: "#39415e", boots: "#3f2f24", hat: "hair", hair: "#33241b", skin: SKINS[0] };
/** the driver: cap, dark green coat, gauntlets */
export const DRIVER: Outfit = { jacket: "#3f5548", pants: "#3b3f52", boots: "#2f2620", hat: "cap", cap: "#4a3a2c", skin: SKINS[1] };
/** Alice: a summer dress and a bonnet, the wreath-bearer */
export const ALICE: Outfit = { jacket: "#c9a0a8", pants: "#7a5a62", boots: "#5a3b2a", hat: "bonnet", dress: "#d9a441", skin: SKINS[2] };
/** the judge: a stout man in a black coat under a top hat, gavel in hand */
export const JUDGE: Outfit = { jacket: "#2f2b33", pants: "#2b2730", boots: "#1e1a20", hat: "tophat", buttons: "#c9a24e", moustache: "#4a3426", skin: SKINS[1], build: "stout" };
/** officials and witnesses: town coats, bowler hats / bare heads */
const OFFICIAL = (v: number): Outfit => ({
  jacket: ["#4a5a7a", "#5d5340", "#3f4a3f"][v % 3], pants: "#3b3f52", boots: "#3a2c22",
  hat: v % 2 ? "tophat" : "hair", hair: ["#4a3426", "#2a201a"][v % 2], skin: SKINS[v % 4], moustache: v % 3 ? "#4a3426" : undefined,
});

// ---------------- effects: the wreath, the confetti, dust ----------------
/** laurel wreath on a 256 x 256 canvas (the prize Alice brings to the finish) */
const wreathDraw = (p: Pen) => {
  const c = 128;
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 - 0.3, r = 78 + (i % 2 ? 5 : -4);
    const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r * 0.9;
    p.ell(x, y, 16, 9.5, i % 3 === 0 ? "#588a3f" : "#6f9c4d", 4.5, 0, 360, (a * 180) / Math.PI);
  }
  p.ell(c, c - 78, 9, 7, "#c9a24e", 3); // the gold berries at the crown
  p.ell(c - 68, c + 44, 9, 7, "#c9a24e", 3);
  p.ell(c + 68, c + 44, 9, 7, "#c9a24e", 3);
};
/** one scrap of confetti on a 64 x 64 canvas */
const confettiDraw = (p: Pen, col: string) => p.poly([[18, 24], [46, 20], [44, 42], [17, 44]], col, 4);
const CONF = ["#d23b3b", "#f3d35a", "#3f6fb5", "#f7f1e1", "#2f8a4f"];

// ---------------- the cast ----------------
/** Fred, the man of the story: rides, staggers, sits, jogs into the tape, stands, runs the 1905 lap, walks off */
const fred = (cam: CamInfo, t: number, out: Stage) => {
  const x = fredX(t), z = fredZ(t), y = fredY(t), m = fredMode(t);
  const sp = fredSpeed(t);
  const who: Who = { i: 1, o: FRED, okey: "fred" };
  const ph = m === "sit" || m === "stand" ? 0 : phaseAt(m, t, m === "jog" ? 15.4 : m === "run" ? 26.04 : m === "stroll" && t > 29 ? 29.267 : 5.36);
  const fo: FrontOpts = { mode: m === "jog" ? "march" : m === "run" ? "march" : m === "stroll" ? "stroll" : m, phase: ph, expr: fredExpr(t), blink: lidAt(t, 1, SWAPS[Math.min(8, Math.max(1, Math.round(t)))] ? undefined : undefined), look: 0, lift: 62 };
  const so: SideOpts = { mode: m === "sit" || m === "stand" ? "stand" : "march", phase: ph, expr: fredExpr(t), blink: lidAt(t, 2), stomp: 0.9, stride: stride(m) };
  const view = m === "sit" ? { side: false, mirror: false } : viewOf(cam, x, z, 1, 0);
  out.places.push(person(cam, who, x, y, z, view, fo, so));
  if (m !== "sit") blob(out, x, y, z, 1.05);
  // footfall dust while he is on the road (one puff per footfall at the current gait rate)
  if ((m === "jog" || m === "run" || m === "stroll") && sp > 0.5) {
    const hz = gaitHz(m), tc = m === "jog" ? 15.4 : m === "run" ? 26.04 : t > 29 ? 29.267 : 5.36;
    const n = Math.floor((t - tc) * hz), age = t - (tc + n / hz);
    if (n >= 0 && age < 0.3) {
      const u = age / 0.3, side = n % 2 ? 1 : -1;
      out.fx.push({ key: `puff${q(u, 24)}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, q(u, 24)), x: x + 0.14 * side, y: y + 0.04,
        z: z + 0.22, w: 0.55 + 0.5 * u, h: 0.5 + 0.45 * u, soft: true });
    }
  }
};

/** the driver at the wheel (shots 1, 3, 4) */
const driver = (cam: CamInfo, t: number, out: Stage) => {
  const x = carX(t) - 0.16, y = 0.72, z = -0.64;
  const expr: Expr = t < 12.3 ? "neutral" : "grin";
  out.places.push(person(cam, { i: 3, o: DRIVER, okey: "driver" }, x, y, z, { side: false, mirror: false },
    { mode: "sit", expr, blink: lidAt(t, 3), look: t > 14 ? 1 : 0 }, {}));
};

/** the crowd on the grandstand: 4 tiers x 9 seats, cheering, then turning on him, then cheering the honest lap */
const crowd = (cam: CamInfo, t: number, out: Stage) => {
  const f = t * FPS;
  for (let k = 0; k < GRAND.tiers; k++) {
    const g = grandTier(k);
    for (let i = 0; i < 9; i++) {
      const n = k * 9 + i, x = GRAND.x0 + 2.1 + i * 3.3 + hh(n, 4) * 0.5, y = g.y, z = g.z - 0.22;
      const v = (n * 3 + 1) % 6, o = townsfolk(v);
      const off = (n * 5 + 2) % 7;
      const expr: Expr = f < BREAK1 ? (off % 3 ? "grin" : "neutral")
        : f < 628 ? (off % 4 === 0 ? "laugh" : off % 2 ? "whistle" : "grin")
        : f < 781 ? (off % 4 === 0 ? "stern" : off % 2 ? "shock" : "nervous")
        : (off % 2 ? "laugh" : "grin");
      const cheer = (f >= BREAK1 && f < 628) || f >= 781;
      out.places.push(person(cam, { i: 100 + n, o, okey: `c${v}` }, x, y, z, { side: false, mirror: false },
        { mode: "sit", expr, blink: n % 3 ? lidAt(t, 100 + n) : 0, look: off % 2 ? 0 : -1 }, {}));
      if (cheer && off % 3 === 0) out.fx.push({ key: `stars${q((t * 0.9 + hh(n)) % 1, 30)}`, cw: 420, ch: 210,
        draw: (p) => fxStars(p, q((t * 0.9 + hh(n)) % 1, 30)), x, y: y + 1.5, z, w: 0.7, h: 0.35 });
      blob(out, x, y, z, 1.05, 0.8);
    }
  }
};

/** Alice, the wreath and the officials of the finish line (shots 5-9) */
const alice = (cam: CamInfo, t: number, out: Stage) => {
  const f = t * FPS, u = clamp01((f - 576) / 14);
  const x = 113.0, z = 0.6;
  const expr: Expr = f < 576 ? "smile_closed" : "grin";
  out.places.push(person(cam, { i: 5, o: ALICE, okey: "alice" }, x, 0, z, viewOf(cam, x, z, 0, -1),
    { mode: "stand", expr, blink: lidAt(t, 5, SWAPS[5]), facing: 1, lift: 40 }, {}));
  blob(out, x, 0, z, 0.95);
  // the wreath: from her hands up over Fred's head (a bezier), then riding on his head until the coda's fade
  const hx = 111.91, hy = 1.62 + (f >= 763 ? 0.02 * (f - 763) : 0), hz = 0.3;
  const p0 = [x - 0.28, 1.16, z - 0.06], p2 = [hx, hy, hz], p1 = [(p0[0] + p2[0]) / 2, 2.5, (p0[2] + p2[2]) / 2 + 0.1];
  const k2 = 1 - u;
  const wx = k2 * k2 * p0[0] + 2 * k2 * u * p1[0] + u * u * p2[0];
  const wy = k2 * k2 * p0[1] + 2 * k2 * u * p1[1] + u * u * p2[1];
  const wz = k2 * k2 * p0[2] + 2 * k2 * u * p1[2] + u * u * p2[2];
  if (f >= 576) out.fx.push({ key: "wreath", cw: 256, ch: 256, draw: wreathDraw, x: wx, y: wy, z: wz, w: 0.62, h: 0.62,
    rot: (f >= 763 ? -0.1 - 0.02 * (f - 763) : 0) + 0.05 * Math.sin(t * 1.7) });
};

/** the two finish officials and, for shots 7-8, the judge at his table and a witness by the rope */
const officials = (cam: CamInfo, t: number, out: Stage, id: number) => {
  const EXPR: Expr[] = ["neutral", "grin", "shock", "stern"];
  for (const [n, x, z] of [[0, 114.55, 0.95], [1, 112.4, -1.7]] as const) {
    const e = id <= 5 ? "grin" : id <= 6 ? "shock" : "neutral";
    out.places.push(person(cam, { i: 7 + n, o: OFFICIAL(n), okey: `off${n}` }, x, 0, z, viewOf(cam, x, z, 0, -1),
      { mode: "stand", expr: e as Expr, blink: lidAt(t, 7 + n), facing: n ? 1 : -1 }, {}));
    blob(out, x, 0, z, 1.0);
  }
  if (id === 7 || id === 8) {
    const v = (id === 7 ? 2 : 0) % 3;
    out.places.push(person(cam, { i: 11, o: OFFICIAL(v), okey: "wit" }, 108.6, 0, -7.5, viewOf(cam, 108.6, -7.5, 1, 0),
      { mode: "stand", expr: EXPR[(id + 1) % 4], blink: lidAt(t, 11), facing: 1 }, {}));
    blob(out, 108.6, 0, -7.5, 1.0);
  }
};

/** the judge: gavel raised and brought down on his table as the verdict lands (shot 8) */
const judge = (cam: CamInfo, t: number, out: Stage) => {
  const x = 104.8, z = -6.15;
  const s = 26.4, n = (t - s) * FPS; // frames to the verdict
  let k = 1;
  if (n >= -12 && n < -7) k = Math.min(k, 1 - smooth((n + 12) / 5));
  else if (n >= -7 && n < 0) k = 0;
  out.places.push(person(cam, { i: 9, o: JUDGE, okey: "judge" }, x, 0, z, { side: false, mirror: false },
    { mode: "stand", expr: n < 0 ? "stern" : "neutral", blink: lidAt(t, 9), prop: ["hammer", q(k, 30)], facing: 0, lift: 44 }, {}));
  blob(out, x, 0, z, 1.1);
  if (t >= s && t < s + 5 / FPS) {
    const u = (t - s) / (5 / FPS);
    out.fx.push({ key: `burst${q(u, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 30)), x: 104.7, y: 0.92, z: -5.1, w: 0.85, h: 0.85 });
  }
};

/** the man whose shout turns the crowd (shot 6) */
const yeller = (cam: CamInfo, t: number, out: Stage) => {
  const x = 117.6, z = -7.6, shake = Math.max(0, Math.sin(t * 9));
  out.places.push(person(cam, { i: 13, o: OFFICIAL(1), okey: "yell" }, x, 0, z, { side: false, mirror: false },
    { mode: "stand", expr: t < 21.5 ? "shock" : "stern", blink: lidAt(t, 13), wave: q(shake, 20), facing: t < 21.5 ? 1 : -1, lift: 40 }, {}));
  blob(out, x, 0, z, 1.05);
};

// ---------------- effects on the road ----------------
/** exhaust, wheel dust and radiator steam under the car */
const carFx = (cam: CamInfo, t: number, out: Stage) => {
  const hz = engineHz(t), sp = carSpeed(t);
  if (f1(t) > 781 / FPS) return;
  if (hz > 0) {
    const u = (t * 5.5) % 1;
    out.fx.push({ key: `exh${q(u, 20)}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, q(u, 20)), x: carX(t) - 1.72, y: 0.5 + 0.1 * u,
      z: -0.3 + 0.6, w: 0.5 + 0.75 * u, h: 0.45 + 0.7 * u, soft: true });
  }
  if (sp > 3) {
    for (const sz of [-1, 1]) {
      const u = (t * 6 + (sz > 0 ? 0.5 : 0)) % 1;
      out.fx.push({ key: `dust${q(u, 20)}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, q(u, 20)), x: carX(t) - 1.05 - 1.3 * u, y: 0.06 + 0.25 * u,
        z: -0.3 + sz * 0.72 + 0.25 * u, w: 0.6 + 1.5 * u, h: 0.5 + 1.2 * u, soft: true });
    }
  }
  if (sp > 9) {
    const u = (t * 3.2) % 1;
    out.fx.push({ key: `steam${q(u, 20)}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, q(u, 20)), x: carX(t) + 2.0, y: 1.15 + 0.3 * u,
      z: -0.3, w: 0.4 + 0.8 * u, h: 0.4 + 0.75 * u, soft: true });
  }
};
const f1 = (t: number) => t * FPS;

/** the tape tearing at each finish (512 and 843): a burst at the tape plus a shower of confetti */
const tapeFx = (cam: CamInfo, t: number, out: Stage) => {
  for (const bt of [BREAK1, BREAK2]) {
    const ts = bt / FPS, d = t - ts;
    if (d < 0 || d > 1.1) continue;
    const u = d / 1.1;
    out.fx.push({ key: `burst${q(u, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 30), "#ffe9a8", 12, 30, 210),
      x: TAPE_X, y: 1.05, z: 0, w: 1.3, h: 1.3 });
    if (d < 0.75) for (let i = 0; i < 16; i++) {
      const seed = hh(i, 3), a = (i / 16) * Math.PI * 2 + seed;
      const sp2 = 2.2 + 2.4 * seed;
      const cxo = Math.cos(a) * sp2 * d, cyo = 2.6 * d - 4.9 * d * d + 0.3, czo = Math.sin(a) * sp2 * d * 0.8;
      out.fx.push({ key: `conf${i % 5}`, cw: 64, ch: 64, draw: (p) => confettiDraw(p, CONF[i % 5]),
        x: TAPE_X + cxo, y: 1.05 + cyo, z: czo, w: 0.14, h: 0.14, rot: (a + d * 9) * 1.7 });
    }
  }
};

// ---------------- stage ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };

/** everything with a face and everything that puffs in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const L = LIGHTS[id >= 9 || t >= 26.03 ? "golden" : "day"];
  LNAME = L === LIGHTS.golden ? "golden" : "day";
  findSun(cam, SUN);
  fred(cam, t, out);
  if (id === 1 || id === 3 || id === 4) driver(cam, t, out);
  if (id >= 5) crowd(cam, t, out);
  if (id === 5) alice(cam, t, out);
  if (id >= 5 && id <= 9) officials(cam, t, out, id);
  if (id === 6) yeller(cam, t, out);
  if (id === 8) judge(cam, t, out);
  carFx(cam, t, out);
  if (id === 5 || id === 9) tapeFx(cam, t, out);
  return out;
};
/** the world direction toward the sun this shot is lit from (world.ts passes it; this is only a fallback) */
function findSun(cam: CamInfo, out: THREE.Vector3) {
  if (cam.sun) return out.copy(cam.sun).normalize();
  return out.set(0.5, 0.75, -0.4).normalize();
}

export { FPS };
export type { V3 };
