// contract.ts — FROZEN INTERFACE for "The Last Tram" (450 frames @ 30 fps = 15.000 s, 1080x1920).
// Every other file in this folder reads its numbers from here and this file is the only place they are
// allowed to change. Deliberately written by ONE author: a film is one agreement, and the street width,
// the tram's track line, its stop position and the character sizes must agree to the centimetre or the
// shots do not cut together. (Post-mortem, 2026-11-13: five agents each owning one file still drifted.)
//
// World frame: the street runs along Z. The tram travels in -Z (toward the camera's far side), stops with
// its centre at z = -2.0, then continues in -Z and recedes into the rain. Buildings face each other at
// x = +/-7.0. Pavements (kerbs) run x = +/-4.62 .. +/-7.0. The camera lives in the street canyon.
import * as THREE from "three";

export const FPS = 30;
export const TOTAL = 450; // 15.000 s exactly

// ---------------------------------------------------------------- deterministic maths
/** Seeded PRNG. Nothing in this composition may use Math.random(): a chunk machine must reproduce
 *  frame N byte-for-byte from the code alone (INSTRUCTIONS.md golden rule / Step 3). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Pure hash of one integer -> [0,1). Used for per-instance jitter that must not change frame to frame. */
export function hash1(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sat = (t: number) => clamp(t, 0, 1);
export const smoothstep = (a: number, b: number, t: number) => { const x = sat((t - a) / (b - a)); return x * x * (3 - 2 * x); };
export const smootherstep = (a: number, b: number, t: number) => { const x = sat((t - a) / (b - a)); return x * x * x * (x * (x * 6 - 15) + 10); };
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - sat(t), 3);
export const easeInQuad = (t: number) => { const x = sat(t); return x * x; };
/** frame-rate independent approach (deterministic: f is the frame number) */
export const approach = (v: number, target: number, k: number, dt: number) => v + (target - v) * (1 - Math.exp(-k * dt));

// ---------------------------------------------------------------- street + tram contract
export const STREET = {
  half: 7.0,        // building faces
  kerb: 4.62,       // pavement / road boundary
  crown: 0.055,     // road camber at the centre
  railX: 0.7175,    // half of the 1435 mm gauge
  waterY: 0.031,    // the flood sheet
  railTop: 0.058,   // rails stand proud of the flood
  zBack: -140,      // far end of the built street
  zFront: 26,       // behind the camera
};

export const TRAM = {
  stopZ: -2.0,
  len: 8.5,
  w: 2.34,
  floorY: 0.60,
  railY: 0.615,      // waist rail
  winY: 1.10,        // window band sill
  winH: 0.86,        // window glass height
  roofY: 2.30,       // eaves / roof springing
  vaultY: 2.56,      // roof vault top
  doorZ: -1.6,       // side doorway centre (in tram-local z) — both ends have one, see DOORS
  bodySide: 1.17,    // half width
};

/** Tram centre-line position (world z) at frame f.
 *  ARRIVE 0-96 travelling in +Z (leading end = +Z, so the white headlamp faces the camera), braking from
 *  z = -22 to the stop; STAND 96-405 at the stop; DEPART 405-450 accelerating away in -Z into the rain.
 *  The long stand is deliberate and is what the soundtrack was built to (shorts/tram/audio/CUES.md): the
 *  controller clack at 300 is the driver changing ends, the boy's boot lands on the step at 352, and the
 *  departure bell rings at 405. An earlier version pulled away at 300, which put the whole boarding — and
 *  the sound of it — 105 frames behind the picture. */
export function tramZ(f: number): number {
  const { stopZ } = TRAM;
  if (f <= 96) return lerp(-22, stopZ, easeInQuad(f / 96)); // easeInQuad as seen from the stop = hard braking
  if (f <= 405) return stopZ;
  return lerp(stopZ, -20, easeInQuad((f - 405) / 45));
}
/** Which end leads: +1 = the +Z end is the front (arrival), -1 = the -Z end (departure). The driver walks
 *  through and changes ends at f = 300 while the car is still standing, so +Z shows the red tail lamp from
 *  then on — that is the 300 controller clack, not the departure. */
export const leadingEnd = (f: number): 1 | -1 => (f <= 300 ? 1 : -1);
/** Metres travelled since frame 0 (used for exact wheel rotation, so wheels never slip). */
export const tramDist = (f: number) => tramZ(0) - tramZ(f);
const WHEEL_R = 0.315;
export const tramWheelAngle = (f: number) => tramDist(f) / WHEEL_R;
/** Body bounce: rail joints under the wheels + a damped settle when the brakes bite at f = 96. */
export function tramBob(f: number): number {
  const roll = 0.0075 * Math.sin(f * 0.83) + 0.0035 * Math.sin(f * 2.11 + 1.7);
  const settle = f > 96 ? 0.026 * Math.exp(-(f - 96) / 9) * Math.sin((f - 96) * 1.15) : 0;
  return roll + settle;
}
/** Slight body sway on the springs (deg): leans into the braking, settles at the stop, kicks on departure. */
export function tramSway(f: number): number {
  if (f <= 96) return -0.55 * (1 - easeOutCubic(f / 96)) - 0.22 * Math.sin(f * 0.6);
  if (f <= 300) return 0.35 * Math.exp(-(f - 96) / 14) * Math.sin((f - 96) * 0.5) - 0.06 * Math.sin(f * 0.42);
  return 0.5 * Math.exp(-(f - 300) / 20) + 0.09 * Math.sin(f * 0.5);
}

// ---------------------------------------------------------------- night light + palette
type C3 = [number, number, number];
/** two-tone uniforms for shade.ts TONE (see lights.ts comment for the field meanings). Night: the "sun" is
 *  the overcast moon, camera-relative and frozen per shot, so the modelling stays readable in every shot. */
export const NIGHT = {
  az: -34, el: 56,
  lit: [0.46, 0.5, 0.62] as C3,   // key (moon through cloud) — cool, slightly blue
  shade: [0.1, 0.115, 0.175] as C3,
  lift: [0.016, 0.02, 0.042] as C3,
  lambert: 0.45, sideK: 0.9, term: 0.25, sat: 1.06, bounce: [0.02, 0.012, 0.006] as C3,
  sunCol: "#cfe0ff", sunI: 1.15,
  hemiSky: "#2b3c5c", hemiGround: "#12161d", hemiI: 0.28,
  // sky/fog are ON-SCREEN targets (untone() writes the linear value that reaches them after the Neutral map)
  top: "#0a1020", hor: "#2b3a54", haze: "#3c4657",
  fog: "#1d2839", fogNear: 5.0, fogFar: 96,
  bias: -0.0004, normalBias: 0.03,
};

/** Emissive/warm palette. Values > 1 are HDR and are picked up by the bloom pass (threshold 1.0). */
export const GLOW = {
  lampGlass: 5.4, lampWarm: "#ffcf86", lampLens: "#fff0d0",
  windowWarm: 2.35, windowDim: 0.55, windowCool: 1.15,
  tramInterior: 2.9, tramInteriorCool: 1.5,
  headlamp: 22.0, headlampLens: "#fff6e2",
  taillight: 3.4, taillightCol: "#ff3a24",
  routeBox: 3.2, routeCol: "#ffd489",
  glintCol: "#ffd7a0",
};

/** Symmetric prop anchors reused by city.ts, weather.ts and story.ts (so the glints sit on the real lamps). */
export const LAMPS: Array<{ x: number; z: number; s: number }> = [
  { x: 5.9, z: 8.5, s: 3.35 }, { x: 5.9, z: -6.5, s: 3.35 }, { x: 5.9, z: -21.5, s: 3.35 },
  { x: -5.9, z: 1.0, s: 3.35 }, { x: -5.9, z: -14.0, s: 3.35 }, { x: -5.9, z: -29.0, s: 3.35 },
];

export const COLOR = {
  green: "#1e3a34", green2: "#142823", trim: "#d9c48c", brass: "#b98b3f",
  brick: "#5c3b33", brick2: "#6b4438", ochre: "#7a6440", grey: "#4d5257", stucco: "#6e6a62",
  slate: "#2f3740", stone: "#5a5f66", asphalt: "#3c4046", wood: "#4a352a",
};

export const v3 = (a: readonly number[]) => new THREE.Vector3(a[0], a[1], a[2]);
