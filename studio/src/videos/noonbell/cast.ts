// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so characters that share an outfit + pose share canvases. Cards are
// yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward the sun, painted crescent
// in the drawing); every standing character gets a soft multiply contact blob plus, by day, a tail away from the sun.
// Effects (dust, flour, birds, the cake, the boat, the rope, the strike burst) are unlit cards. Cards, effects and
// blobs live on the NOINK layer so the world ink pass never outlines their quads.
//
// Every position/pose comes from ./contract (pipPos/pipMode/cakePos/bakerSpot/boatmanPos/goosePos/bellStrike...), and
// crowds are keyed purely on t so that two cross-faded shots ask for identical canvases.
import * as THREE from "three";
import {
  Pen, Outfit, Expr, FrontOpts, SideOpts, Folk, Gait, ArmMode,
  bodyFront, bodySide, bodyGoose, bodyDog,
  PIP, BAKER, BRIDE, GROOM, RINGER, BOATMAN, marketFolk, churchGuest,
  fxPuff, fxFlour, fxCake, fxBird, fxGlow, fxRope, fxBoat, fxRing, fxShadow, fxContact, fxBlob,
} from "./toon";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";
import { LIGHTS } from "./lights";
import {
  FPS, GEESE, WATER_Y, Z_MARKET, Z_SQUARE, Z_DOOR, Z_TOWER, clamp01, lin, streetY,
  pipPos, pipYaw, pipMode, PipMode, cakePos, cakeHeld, bakerSpot, bakerPos, bakerYaw,
  boatmanPos, boatmanYaw, goosePos, gooseBob, bellAngle, bellStrike,
} from "./contract";

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
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m (the 600 x 1000 card)
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), on the NOINK layer */
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
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (church, birds, the cake), soft see-through (dust, mist, glow) or a multiply pool */
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
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };
export type Stage = { places: Place[]; fx: FxPlace[] };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
/** head-shape seed: 7 shapes so characters that share an outfit still get distinct bean heads */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1080 x 1920 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
const DAY = LIGHTS.day; // every SHOT_TIME entry is "day"
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) facing along (dx, dz); fs = foreshortening of the facing */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks ----------------
/** reference expression and action changes land 0-3 f before the change; a blink hides every swap */
const LEAD = 2 / FPS;
const LID = [0.5, 1, 1, 0.5];
/** eyelid 0 open .. 1 shut; gaps 0.5-2.3 s, plus a 4-frame blink across every expression swap */
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13));
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean },
  fo: FrontOpts, so: SideOpts, scale = 1): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return { key, x, y, z, scale, mirror, size: [w, h, k], draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)) };
};

/** ground pool under a character: a tight contact right under the feet so nobody floats, plus (by day, since cards
 *  cast no real shadow) a lighter soft tail stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. */
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: readonly [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
/** the preset's ambient shadow tint (linear); the contact pool is that tint pushed toward black, the tail is the tint */
const CONTACT_K = 2.4, TAIL_K = 1.05;
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
  const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h;
  const tc = hexOf(DAY.blob, TAIL_K * k);
  out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
    w: 0.72 * sc, h, flat: true, rot });
  const cc = hexOf(DAY.blob, CONTACT_K * k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ===================================================================================================================
// Pip
// ===================================================================================================================
/** Pip's leg cycle: the cadence follows his real ground speed (one 1.4 m cycle per two 0.7 m steps), capped at 2.6
 *  cycles/s so the bridge shot reads as a quick walk and not a strobe. The integral is piecewise linear in t, so it is
 *  the same number in any cross-faded shot (crowds and poses are keyed on t alone). */
const PIP_CYC: readonly (readonly [number, number])[] = [
  [0, 0], [3.933, 5.70], [8.333, 15.38], [12.267, 24.04], [16.667, 35.48],
  [20.667, 45.48], [24.733, 55.24], [27.8, 58.09], [30, 62.34],
];
const pipPhase = (t: number) => (((lin(PIP_CYC, t) % 1) + 1) % 1);
const PIP_SWAPS = [12.3, 13.0, 20.6, 22.2, 27.9, 29.0];
const PIP_POSE: Record<PipMode, { g: Gait; lean: number; squat: number; up: number }> = {
  carry: { g: "walk", lean: 0, squat: 0, up: 0 },
  crouch: { g: "crouch", lean: 0, squat: 1, up: 0 },
  climb: { g: "walk", lean: 10, squat: 0, up: 0 },
  stop: { g: "stand", lean: 0, squat: 0, up: 1 },
  present: { g: "stand", lean: 2, squat: 0, up: 0.15 },
};
const pipExpr = (t: number, m: PipMode): Expr => {
  if (m === "crouch") return "nervous";
  if (m === "climb") return "pained";
  if (m === "stop") return "awe";
  if (m === "present") return "beam";
  if (t > 8.3 && t < 12.3) return "nervous";
  if (t > 24.9) return "grin";
  return "smile";
};

/** the cake: an unlit card that always sits a little in FRONT of Pip's card (an along-the-view offset is invisible
 *  on screen but fixes the draw order), wobbling while he climbs and puffing flour when he saves it. */
const cake = (cam: CamInfo, t: number, out: Stage) => {
  if (!cakeHeld(t)) return;
  const C = cakePos(t), m = pipMode(t);
  const vx = cam.pos.x - C[0], vy = cam.pos.y - C[1], vz = cam.pos.z - C[2], vl = Math.hypot(vx, vy, vz) || 1;
  const off = m === "present" ? 0.5 : 0.3;
  const x = C[0] + (vx / vl) * off, y = C[1] - 0.06 + (vy / vl) * off, z = C[2] + (vz / vl) * off;
  const wob = m === "climb" ? 0.17 * Math.sin(t * 13) : m === "present" ? 0.03 * Math.sin(t * 5) : 0.035 * Math.sin(t * 6.5 + 1);
  const u = q(wob, 40);
  out.fx.push({ key: `cake|${u}`, cw: 260, ch: 340, draw: fxCake, x, y, z, w: 0.3, h: 0.39, rot: u });
  // the stumble on the climb: the cake tips, flour comes out of it
  const fu = (t - 20.95) / 0.85;
  if (fu > 0 && fu < 1) {
    const fq = q(fu, 20);
    out.fx.push({ key: `flour|${fq}`, cw: 360, ch: 360, draw: (p) => fxFlour(p, fq), x: x - 0.02, y: y + 0.16, z, w: 0.55 + 0.3 * fq, h: 0.55 + 0.3 * fq, soft: true });
  }
};

const pip = (cam: CamInfo, t: number, out: Stage) => {
  const P = pipPos(t), yaw = pipYaw(t), m = pipMode(t), pose = PIP_POSE[m];
  const dx = -Math.sin(yaw), dz = -Math.cos(yaw);
  const view = viewOf(cam, P[0], P[2], dx, dz);
  const ph = q(pipPhase(t), 120);
  const expr = pipExpr(t, m), look = Math.max(-1, Math.min(1, Math.round(Math.sin(t * 0.7) * 1.2)));
  const blink = lidAt(t, 3, PIP_SWAPS);
  const fo: FrontOpts = { mode: pose.g, phase: ph, expr, arms: "carry", look, up: pose.up, blink, tilt: 0, lean: pose.lean, squat: pose.squat, facing: 0 };
  const so: SideOpts = { mode: pose.g, phase: ph, expr, arms: "carry", blink, lean: pose.lean, squat: pose.squat, stride: view.fs };
  out.places.push(person(cam, { i: 3, o: PIP, okey: "pip" }, P[0], P[1], P[2], view, fo, so));
  blob(out, P[0], P[1], P[2]);
  // footfall dust, only when the lens is close enough to see it
  const dist = cam.pos.distanceTo(tmp.set(P[0], P[1] + 1.1, P[2]));
  if (dist < 9 && (pose.g === "walk" || pose.g === "crouch")) {
    for (const fp of [0, 0.5]) {
      const age = ((pipPhase(t) - fp) % 1 + 1) % 1;
      if (age > 0.34) continue;
      const aq = q(age / 0.34, 20);
      out.fx.push({ key: `dust|${aq}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, aq), x: P[0] + (fp ? 0.1 : -0.1), y: P[1] + 0.06,
        z: P[2] + 0.12, w: 0.34 + 0.2 * aq, h: 0.34 + 0.2 * aq, soft: true });
    }
  }
};

// ===================================================================================================================
// the baker, the bride and groom, the bell-ringer, the boatman, the geese, critters
// ===================================================================================================================
const baker = (cam: CamInfo, t: number, out: Stage) => {
  const spot = bakerSpot(t);
  if (spot === "away") return;
  const P = bakerPos(t), yaw = bakerYaw(t);
  const dx = -Math.sin(yaw), dz = -Math.cos(yaw);
  const view = viewOf(cam, P[0], P[2], dx, dz);
  const shop = spot === "shop";
  const expr: Expr = shop ? "beam" : "smile";
  const arms: ArmMode = shop ? (t < 1.6 ? "wave" : "reach") : "hang";
  const blink = lidAt(t, 21, shop ? [0.9, 1.6] : []);
  const fo: FrontOpts = { mode: "stand", expr, arms, look: shop ? -1 : 1, blink };
  const so: SideOpts = { mode: "stand", expr, arms, blink };
  out.places.push(person(cam, { i: 21, o: BAKER, okey: "baker" }, P[0], P[1], P[2], view, fo, so));
  blob(out, P[0], P[1], P[2]);
};

/** the wedding couple, waiting at the church door from shot 6 on */
const couple = (cam: CamInfo, t: number, out: Stage) => {
  if (t < 20.7) return;
  const spots: [number, number, Outfit, string, number][] = [
    [(Z_DOOR + 3.4), -1.15, BRIDE, "bride", 33], [(Z_DOOR + 3.1), 1.15, GROOM, "groom", 34],
  ];
  for (const [z, x, o, okey, i] of spots) {
    const y = streetY(z), view = viewOf(cam, x, z, 0, -1);
    const blink = lidAt(t, i, [21.0, 27.9]);
    const arms: ArmMode = okey === "bride" ? "bouquet" : "crossed";
    const expr: Expr = t < 27.5 ? "smile_closed" : "beam";
    out.places.push(person(cam, { i, o, okey }, x, y, z, view,
      { mode: "stand", expr, arms, look: -1, blink }, { mode: "stand", expr, arms, blink }));
    blob(out, x, y, z);
  }
};

/** the bell-ringer in the belfry: he leans back on the rope, the rope jumps with the bell */
const BELFRY: [number, number, number] = [0.0, 9.0, Z_TOWER - 0.4]; // ~9 m up the tower; retune against world.ts
const ringer = (cam: CamInfo, t: number, out: Stage) => {
  if (t < 24.0) return;
  const pull = clamp01((bellAngle(t) - 0.06) / 0.56);
  const sway = Math.sin(t * 2.4) * 0.5 + pull * 0.5;
  const view = viewOf(cam, BELFRY[0], BELFRY[2], 0, 1); // he faces the nave (+z)
  const blink = lidAt(t, 41, [27.2, 29.1]);
  const expr: Expr = t < 29.0 ? "stern" : "relief";
  const fo: FrontOpts = { mode: "stand", expr, arms: "rope", pull, lean: 6 + 8 * pull, blink };
  const so: SideOpts = { mode: "stand", expr, arms: "rope", pull, lean: 6 + 8 * pull, blink };
  out.places.push(person(cam, { i: 41, o: RINGER, okey: "ringer" }, BELFRY[0], BELFRY[1], BELFRY[2], view, fo, so));
  // the rope continues out of the top of his card up to the beam the bell hangs from
  out.fx.push({ key: `rope|${q(sway)}`, cw: 90, ch: 620, draw: (p) => fxRope(p, q(sway)), x: BELFRY[0] + 0.1 * sway,
    y: BELFRY[1] + 2.11 + 0.62, z: BELFRY[2], w: 0.2, h: 1.35 });
};

/** the boatman, rowing under the bridge in shot 4; the hull is a separate card a little in front of him */
const boatman = (cam: CamInfo, t: number, out: Stage) => {
  if (t < 11.8 || t > 17.6) return;
  const P = boatmanPos(t), yaw = boatmanYaw(t);
  const dx = -Math.sin(yaw), dz = -Math.cos(yaw);
  const view = viewOf(cam, P[0], P[2], dx, dz);
  const vx = cam.pos.x - P[0], vy = cam.pos.y - P[1], vz = cam.pos.z - P[2], vl = Math.hypot(vx, vy, vz) || 1;
  const bx = P[0] + (vx / vl) * 0.55, by = WATER_Y + 0.35 + (vy / vl) * 0.55, bz = P[2] + (vz / vl) * 0.55;
  const rock = 0.035 * Math.sin(t * 1.7);
  const blink = lidAt(t, 51, []);
  const fo: FrontOpts = { mode: "stand", expr: "smile", arms: "oar", look: -1, blink };
  const so: SideOpts = { mode: "stand", expr: "smile", arms: "oar", blink };
  out.places.push(person(cam, { i: 51, o: BOATMAN, okey: "boat" }, P[0], P[1], P[2], view, fo, so));
  out.fx.push({ key: `boat|${q(rock, 40)}`, cw: 560, ch: 250, draw: (p) => fxBoat(p, q(rock, 40)), x: bx, y: by, z: bz, w: 2.6, h: 1.16 });
  // wake: two flat rings trailing the boat, and the water darkened where the hull meets it
  for (const [k, lag] of [[0, 0.5], [1, 1.4]] as const) {
    const uz = ((t - 12 + lag) % 1.9) / 1.9;
    out.fx.push({ key: `wake${k}|${q(uz, 20)}`, cw: 600, ch: 600, draw: (p) => fxRing(p, q(uz, 20)), x: P[0] - 0.2 * k,
      y: WATER_Y + 0.03, z: bz + dz * (lag * 1.3), w: 2.2 + 1.4 * uz, h: 2.2 + 1.4 * uz, flat: true });
  }
  const wc = hexOf([0.3, 0.36, 0.52], 1);
  out.fx.push({ key: `blob|contact|${wc}`, cw: 128, ch: 128, draw: (p) => fxBlob(p, wc), x: bx, y: WATER_Y + 0.05, z: bz, w: 2.4, h: 1.0, flat: true });
};

/** the two geese that follow Pip through the market (they leave at the bridge) */
const geese = (cam: CamInfo, t: number, out: Stage) => {
  if (t < 1.4 || t >= 17) return;
  const yaw = pipYaw(t - 0.35), fdx = -Math.sin(yaw), fdz = -Math.cos(yaw);
  for (let i = 0; i < GEESE; i++) {
    const P = goosePos(t, i), bob = gooseBob(t, i);
    const mirror = fdx * cam.right.x + fdz * cam.right.z < 0;
    const light = light2D(cam, mirror);
    const d = cam.pos.distanceTo(tmp.set(P[0], P[1] + 0.35, P[2]));
    const [w, h, k] = tier(d);
    const bq = q(bob, 30);
    out.places.push({ key: `goose|${i}&${bq}|${mirror ? 1 : 0}`, x: P[0], y: P[1], z: P[2], scale: 0.73, size: [w, h, k],
      draw: (p) => bodyGoose(p, { bob: bq, light, seed: 5 + i, facing: mirror ? -1 : 1 }) });
    blob(out, P[0], P[1], P[2], 0.55, 0.7);
  }
};

/** a market dog trotting past the stalls in shots 2-3 (a ninth silhouette, and it fills the near ground) */
const dog = (cam: CamInfo, t: number, out: Stage) => {
  if (t < 5.0 || t > 12.3) return;
  const x = -2.6 + 0.55 * Math.sin(t * 0.9), z = ((Z_MARKET - 3) + 1.5 * (t - 5)) % 22 + 2;
  const y = streetY(z), m = Math.sin(t * 1.6) > 0;
  const d = cam.pos.distanceTo(tmp.set(x, y + 0.3, z));
  const [w, h, k] = tier(d);
  out.places.push({ key: `dog|${q((t * 2.2) % 1, 30)}|${m ? 1 : 0}`, x, y, z, scale: 0.62, size: [w, h, k],
    draw: (p) => bodyDog(p, { bob: q((t * 1.6) % 1, 20), light: light2D(cam, m), seed: 9, facing: m ? -1 : 1, wag: Math.sin(t * 6) }) });
  blob(out, x, y, z, 0.5, 0.7);
};

// ===================================================================================================================
// crowds (keyed purely on t so cross-faded shots ask for identical canvases)
// ===================================================================================================================
const MKT = 16, CHU = 14;
const putFolk = (cam: CamInfo, out: Stage, who: Who, x: number, y: number, z: number, fdx: number, fdz: number,
  mode: Gait, phase: number, expr: Expr, look: number, blink: boolean | number, arms: ArmMode, sc = 1) => {
  const view = viewOf(cam, x, z, fdx, fdz);
  const fo: FrontOpts = { mode, phase, expr, arms, look, blink, lift: sc < 1 ? 46 : 60, tilt: 0 };
  const so: SideOpts = { mode, phase, expr, arms, blink, stride: view.fs * sc };
  out.places.push(person(cam, who, x, y, z, view, fo, so, sc));
  blob(out, x, y, z, sc);
};
const EXPR4: Expr[] = ["smile", "grin", "neutral", "smile_closed"];

/** market shoppers and kids, browsing the stalls Pip weaves through (t 4 - 12.3) */
const market = (cam: CamInfo, t: number, out: Stage) => {
  for (let i = 0; i < MKT; i++) {
    const f = marketFolk(i);
    const walk = i % 3 === 0, dir = i % 6 === 0 ? 1 : -1;
    const sp = (0.62 + hh(i, 4) * 0.4) * (f.kid ? 1.15 : 1);
    const z0 = Z_MARKET + 11 - (i % 5) * 4.6 + (hh(i, 6) - 0.5) * 1.8;
    const z = Math.max(2, Math.min(30, walk ? z0 + dir * sp * (t - 8.3) : z0));
    const x = (i % 2 ? 1 : -1) * (1.3 + (i % 4) * 1.1) + (hh(i, 5) - 0.5) * 0.7;
    const y = streetY(z);
    const fdx = walk ? 0 : -Math.sign(x) || 1, fdz = walk ? dir : 0;
    const expr: Expr = i % 7 === 2 ? "laugh" : EXPR4[i % 4];
    const look = walk ? 0 : (i % 3 === 0 ? 1 : 0);
    const blink = lidAt(t, 200 + i);
    const arms: ArmMode = walk ? "hang" : f.arms;
    putFolk(cam, out, { i: 200 + i, o: f.o, okey: `m${i}` }, x, y, z, fdx, fdz,
      walk ? "walk" : "stand", walk ? q(((t * sp) / 1.4 + hh(i, 7)) % 1, 120) : 0, expr, look, blink, arms, f.kid ? 0.94 : 1);
  }
};

/** the church guests in Sunday best, gathering from shot 6 on */
const church = (cam: CamInfo, t: number, out: Stage) => {
  for (let i = 0; i < CHU; i++) {
    const f = churchGuest(i);
    const row = i % 2, k = (i >> 1) % 7;
    const x = (row ? 1 : -1) * (1.8 + k * 0.86) + (hh(i, 3) - 0.5) * 0.6;
    const z = Z_SQUARE + 5.5 - k * 2.4 + row * 1.4 + (hh(i, 4) - 0.5) * 1.2;
    const walk = i % 5 === 4, dir = i % 4 === 0 ? -1 : 1;
    const zz = walk ? z + dir * 0.5 * (t - 20.7) : z;
    const fdx = walk ? 0 : -Math.sign(x) || 1, fdz = walk ? dir : 0;
    const expr: Expr = t > 29.05 ? "beam" : t > 27.5 ? "grin" : EXPR4[(i + 1) % 4];
    const blink = lidAt(t, 300 + i, [29.1]);
    putFolk(cam, out, { i: 300 + i, o: f.o, okey: `c${i}` }, x, streetY(zz), zz, fdx, fdz,
      walk ? "walk" : "stand", walk ? q(((t * 0.5) / 1.4 + hh(i, 5)) % 1, 120) : 0, expr, walk ? 0 : 1, blink,
      walk ? "hang" : f.arms, f.kid ? 0.94 : 1);
  }
};

/** a few gulls over the rooftops (daytime, distant, tiny) */
const birds = (cam: CamInfo, t: number, out: Stage) => {
  if (t < 2.5) return;
  for (let i = 0; i < 3; i++) {
    const k = ((t * (0.09 + i * 0.028) + hh(i, 8)) % 1 + 1) % 1;
    const x = -26 + k * 52 + i * 2.5;
    const y = 13.5 + i * 2.6 + 0.5 * Math.sin(t * 0.8 + i);
    const z = Z_MARKET - 26 - i * 14;
    if (cam.pos.distanceTo(tmp.set(x, y, z)) > 70) continue;
    const up = q((t * 3.2 + i) % 1, 12) < 0.5 ? 0 : 1;
    out.fx.push({ key: `bird${up}`, cw: 160, ch: 80, draw: (p) => fxBird(p, up), x, y, z, w: 0.8, h: 0.4 });
  }
};

/** the noon strike: a warm burst at the bell mouth (the film's payoff beat) */
const strike = (t: number, out: Stage) => {
  const s = bellStrike(t);
  if (s <= 0) return;
  const u = q(1 - s, 24);
  out.fx.push({ key: `glow|${u}`, cw: 720, ch: 720, draw: (p) => fxGlow(p, u), x: BELFRY[0], y: BELFRY[1] + 0.9,
    z: BELFRY[2], w: 7.5, h: 7.5, soft: true });
};

// ===================================================================================================================
// the frame
// ===================================================================================================================
/** everything with a face at time t (seconds); id is the shot, but the crowds are gated on t alone */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  findSun(cam, SUN);
  pip(cam, t, out);
  cake(cam, t, out);
  baker(cam, t, out);
  couple(cam, t, out);
  ringer(cam, t, out);
  boatman(cam, t, out);
  geese(cam, t, out);
  dog(cam, t, out);
  if (t >= 4 && t < 12.3) market(cam, t, out);
  if (t >= 20.7) church(cam, t, out);
  birds(cam, t, out);
  strike(t, out);
  return out;
};
