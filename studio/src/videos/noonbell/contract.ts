// ===================================================================================================================
// "Pip and the Noon Bell" — THE CONTRACT. Every module in this folder imports its shared numbers from here and
// nothing else may invent its own copy of them. Written by the lead BEFORE the four module agents start, so that
// world.ts / cast.ts / story.ts can be authored independently and still compile and line up together.
//
// The film: 1080x1920, 30 fps, TOTAL = 900 frames = 30.000 s. Daytime. Silent (music + SFX, no voiceover, no
// captions). ONE continuous hillside-town street that all eight shots live on; travel direction is -z. Pip, a
// bakery apprentice, carries a wedding cake from the bakery (z = +34) down the street, over the river bridge and
// up the climb to the church door (z = -82) before the noon bell. Landmarks are separated only by z.
//
// Style authority: references/reports/*.md + references/STYLE_BIBLE.md (read them). The bridge film in
// ../bridge/ is the working implementation of those recipes; copy its structure, not its story.
// ===================================================================================================================
import * as THREE from "three";

// ---------------- time ----------------
export const FPS = 30;
export const TOTAL = 900; // 30.000 s
export const tOf = (f: number) => f / FPS;

// ---------------- math (shared by every module) ----------------
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
/** symmetric smootherstep — the reference camera ease (motion.md): attack == release. Use for every glide. */
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const mix = (a: number, b: number, k: number) => a + (b - a) * k;
/** piecewise-linear table lookup: pts are [t, value] sorted by t. */
export const lin = (pts: readonly (readonly [number, number])[], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (x - x0)) / Math.max(1e-9, x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
};

// ---------------- shared vocabulary ----------------
export type V3 = [number, number, number];
export type Light = "day" | "golden";
/** the eight places, in the order Pip passes them (travel is -z). */
export type Spot = "bakery" | "market" | "lane" | "bridge" | "climb" | "square" | "tower" | "door";

// ---------------- the street (metres; y = 0 is low-town street level) ----------------
export const STREET_HALF = 5.5;   // walkable half-width: x in [-5.5, 5.5]
export const Z_START = 34;        // Pip's first frame (bakery door)
export const Z_BAKERY = 30;       // bakery facade line
export const Z_MARKET = 14;       // market-square centre
export const Z_LANE = -4;         // the lane (cart)
export const RIVER_Z1 = -12;      // near bank of the river (bridge deck starts)
export const RIVER_Z0 = -32;      // far bank (bridge deck ends)
export const Z_RIVER = -22;       // river centre line
export const WATER_Y = -3.4;      // water surface
export const RAMP0 = -44;         // foot of the climb
export const RAMP1 = -58;         // top of the climb
export const RAMP_H = 2.2;        // church terrace height above low town
export const Z_SQUARE = -62;      // church-square centre (on the terrace)
export const Z_TOWER = -76;       // bell-tower base
export const Z_DOOR = -84;        // church door
export const Z_END = -86;

/** the bridge deck hump (a shallow camber, peaked at the river centre). */
export const camber = (z: number) => 0.32 * Math.max(0, 1 - ((z - Z_RIVER) / 11) ** 2);
/** THE walking surface: every actor, prop and camera floor reference uses this, never a bare 0. */
export const streetY = (z: number) => RAMP_H * smooth(clamp01((RAMP0 - z) / (RAMP0 - RAMP1))) + camber(z);
/** visible retaining wall on each side of the climb (world.ts draws these; the lane stays open in the middle). */
export const climbWallX = 4.6;
/** is z over open water (so world.ts leaves a hole and draws water instead of paving)? */
export const overWater = (z: number) => z < RIVER_Z1 && z > RIVER_Z0;

// ---------------- the eight shots: where Pip is, and when ----------------
export type ShotTime = { id: number; a: number; b: number; spot: Spot; light: Light; z0: number; z1: number; note: string };
/** Shot boundaries are fixed. story.ts owns the CAMERA; this table owns the SUBJECT. Times are frames. */
export const SHOT_TIME: readonly ShotTime[] = [
  { id: 1, a: 0, b: 118, spot: "bakery", light: "day", z0: 34, z1: 26, note: "the hand-over: baker gives Pip the cake and waves him off" },
  { id: 2, a: 118, b: 250, spot: "market", light: "day", z0: 26, z1: 6, note: "weaves through the market crowd, two geese in tow" },
  { id: 3, a: 250, b: 368, spot: "lane", light: "day", z0: 6, z1: -10, note: "a cart blocks the lane; he ducks under the axle" },
  { id: 4, a: 368, b: 500, spot: "bridge", light: "day", z0: -10, z1: -44, note: "pauses on the bridge as the boatman rows under" },
  { id: 5, a: 500, b: 620, spot: "climb", light: "day", z0: -44, z1: -58, note: "the climb: the cake tilts, he saves it" },
  { id: 6, a: 620, b: 742, spot: "square", light: "day", z0: -58, z1: -72, note: "the church square: guests gather, the tower looms" },
  { id: 7, a: 742, b: 834, spot: "tower", light: "day", z0: -72, z1: -76, note: "the bell: it swings, the rope jumps, Pip runs the last yards" },
  { id: 8, a: 834, b: TOTAL, spot: "door", light: "day", z0: -76, z1: -82, note: "the delivery: the bell strikes as the cake lands intact" },
];
export const shotIndexAt = (f: number) => {
  for (let i = SHOT_TIME.length - 1; i >= 0; i--) if (f >= SHOT_TIME[i].a) return i;
  return 0;
};
export const spotAt = (f: number) => SHOT_TIME[shotIndexAt(f)].spot;

// ---------------- Pip ----------------
const PIP_TZ: readonly (readonly [number, number])[] = [
  [0, Z_START], [118, 26], [250, 6], [368, -10], [500, -44], [620, -58], [742, -72], [834, -76], [900, -82],
];
/** Pip's z (forward progress). Continuous across every cut. */
export const pipZ = (t: number) => lin(PIP_TZ, t);
/** lateral weave: a small +-x swing while he dodges the market and the lane; 0 on the bridge and the climb. */
export const pipX = (t: number) => {
  const w = 0.55 * Math.sin(t * 0.9) * (t < 8.3 ? 1 : 0) + 0.9 * Math.sin(t * 1.35 + 0.7) * (t >= 8.3 && t < 12.3 ? 1 : 0);
  return w;
};
export const pipPos = (t: number): V3 => [pipX(t), streetY(pipZ(t)), pipZ(t)];
/** facing yaw in radians: 0 = forward is -z, +pi/2 = forward is +x (screen right when looking down -z). */
export const pipYaw = (t: number) => {
  const dz = pipZ(t + 0.1) - pipZ(t - 0.1), dx = pipX(t + 0.1) - pipX(t - 0.1);
  return Math.atan2(-dx, -dz);
};
/** what Pip is doing, for cast.ts to pose. carry = cake in both hands at chest, crouch = ducking the cart axle,
 *  climb = leaning into the slope, stop = stood looking up at the bell, present = cake held out at the church door. */
export type PipMode = "carry" | "crouch" | "climb" | "stop" | "present";
export const pipMode = (t: number): PipMode => {
  if (t < 12.3) return "carry";
  if (t < 13.0) return "crouch";
  if (t < 20.6) return "carry";
  if (t < 22.2) return "climb";
  if (t < 27.9) return "carry";
  if (t < 29.0) return "stop";
  return "present";
};

// ---------------- the cake ----------------
/** the cake sits in Pip's hands (chest height, a little in front) until he holds it out at the door. */
export const cakePos = (t: number): V3 => {
  const [x, y, z] = pipPos(t), mode = pipMode(t);
  const reach = mode === "present" ? 0.55 : 0.34;
  return [x, y + (mode === "climb" ? 1.05 : 1.18), z - reach];
};
/** true while the cake is in Pip's hands; false only for the first third of a second (the hand-over). */
export const cakeHeld = (t: number) => t > 0.45;

// ---------------- the baker ----------------
/** the baker is at his shop for shot 1, then a face in the church crowd from shot 6 on. */
export const bakerSpot = (t: number): "shop" | "away" | "church" => (t < 3.0 ? "shop" : t < 21.5 ? "away" : "church");
export const bakerPos = (t: number): V3 => (bakerSpot(t) === "shop" ? [2.0, streetY(Z_BAKERY), Z_BAKERY - 0.4] : [1.5, streetY(Z_DOOR + 2.5), Z_DOOR + 2.5]);
export const bakerYaw = (t: number) => (bakerSpot(t) === "shop" ? -Math.PI / 2 : Math.PI);

// ---------------- the boatman (shot 4 only) ----------------
// The street crosses the river along z, so the river itself runs along x. The boat therefore rows in -x at the
// river's centre line (z = Z_RIVER) and passes under the arch while Pip pauses on the span.
export const boatmanX = (t: number) => 24 - (t - 12.0) * 5.2; // x = +24 at t 12.0 -> x = 0 at t 16.6 -> -28 at 17.9
export const boatmanZ = Z_RIVER;
export const boatmanPos = (t: number): V3 => [boatmanX(t), WATER_Y + 0.15, Z_RIVER];
export const boatmanYaw = (t: number) => Math.PI / 2; // facing -x: downriver, under the bridge

// ---------------- the geese (shots 2-4) ----------------
export const GEESE = 2;
export const goosePos = (t: number, i: number): V3 => {
  const back = 1.5 + i * 0.9, sway = 0.42 * Math.sin(t * 2.1 + i * 2.3);
  return [pipX(t - 0.35) + sway + (i ? 0.5 : -0.5), streetY(pipZ(t - 0.35)) , pipZ(t - 0.35) + back];
};
/** geese head-bob: 0..1, use for the neck/step. */
export const gooseBob = (t: number, i: number) => (Math.sin(t * 6 + i * 1.7) + 1) / 2;

// ---------------- the bell (shots 7-8) ----------------
export const BELL_AT = 27.2; // seconds — the first swing
export const BELL_STRIKE = 29.1; // seconds — the noon strike (the film's payoff beat)
/** the bell's tilt in radians around its beam (0 = at rest, held over by the rope). Swings, then strikes. */
export const bellAngle = (t: number) => {
  if (t < BELL_AT) return 0.06;
  const u = t - BELL_AT, f = 0.85; // Hz
  const amp = Math.min(0.62, 0.16 + 0.5 * smooth(u / 1.4));
  return Math.sin(2 * Math.PI * f * u) * amp;
};
/** 0..1 impact flash for the strike frame, for world/cast to brighten the bell mouth. */
export const bellStrike = (t: number) => {
  if (t < BELL_STRIKE || t > BELL_STRIKE + 0.5) return 0;
  return 1 - (t - BELL_STRIKE) / 0.5;
};

// ---------------- foreground / eyelash objects (story.ts FOREGROUND drives these) ----------------
export type Fg = { a: number; b: number; crate: string; x: number; y: number; z: number; s: number; yaw?: number };

/** every camera position is a 3-tuple in metres; the composer reads camAt() from story.ts. */
export type Cam = { pos: V3; look: V3; fov: number; roll: number };

/** small shared helper: where is the front of the crowd / the subject's chest — used for focus points. */
export const chestOf = (p: V3): V3 => [p[0], p[1] + 1.15, p[2]];
export const headOf = (p: V3): V3 => [p[0], p[1] + 1.62, p[2]];
export const v3 = (v: V3) => new THREE.Vector3(v[0], v[1], v[2]);
