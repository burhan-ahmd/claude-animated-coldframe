// story.ts — "The Last Tram" (1902). FROZEN TIMELINE. The picture's time constants live here and nowhere else;
// the sound design (studio/shorts/tram/audio/) and the QA shot map (out/qa/tram_shots.json) are derived from this
// file, so changing anything here invalidates the audio and the QA map.
// Silent film: no voice, no subtitles (INSTRUCTIONS.md golden rule 8 — SFX + ambience only, nothing to caption).
//
//   shot  frames   lens   what you see
//   1     0-70     33     Rain-swept street, high on the +X pavement. Far down it, one headlamp glows.
//   2     70-150   40->37 The tram brakes and pulls up into frame, its lit end filling the near left.
//   3     150-248  50     Stopped. Lit saloon on the left, the boy with his paper boat at the kerb, a lady
//                         crossing the flood with her umbrella beyond him.
//   4     248-330  36     Close, low: the boat set on the water in the gutter; the tram's window light
//                         stretched across the ripples, because the lens cannot hold the boat and the tram.
//   5     330-405  44     The doorway. The conductor leans out; the boy crosses the flooded gutter and climbs.
//   6     405-450  34     The tram pulls away into the rain, tail lamp red. The paper boat is left bobbing.
//
// The street is 14 m wide and the frame is VERTICAL (1080x1920), so the horizontal half-angle is only
// atan(tan(fov/2) x 0.5625) — 9.8 deg at fov 34, 14.7 deg at fov 50. Every camera below was placed by tracing the
// actors' and the tram's azimuth through that cone; the wide lens on shots 3 and 5 is what lets the boy, the
// conductor and the tram share a frame at all.
import * as THREE from "three";
import { TOTAL, TRAM, STREET, tramZ, mulberry32, smootherstep, sat, lerp, clamp, smoothstep } from "./contract";

export const SHOTS: Array<{ id: number; a: number; b: number }> = [
  { id: 1, a: 0, b: 70 },
  { id: 2, a: 70, b: 150 },
  { id: 3, a: 150, b: 248 },
  { id: 4, a: 248, b: 330 },
  { id: 5, a: 330, b: 405 },
  { id: 6, a: 405, b: 450 },
];
/** Dissolves: boundary frame + half-width in frames. Hard cuts at 70 and 405 (a cut lands an arrival better
 *  than a dissolve). 6-frame dissolves only, so the second scene render stays cheap. */
export const XFADE: Array<{ at: number; n: number }> = [{ at: 150, n: 6 }, { at: 248, n: 6 }, { at: 330, n: 6 }];
/** Camera shakes: frame, amplitude (m), decay (f). Alternating sign, exponential decay — a smooth decay would
 *  read as hand-held float instead of an impact. */
export const KICKS: Array<{ f: number; amp: number; dec: number }> = [
  { f: 92, amp: 0.055, dec: 7 },   // the brake shoes bite
  { f: 204, amp: 0.016, dec: 5 },  // the paper boat touches the water
  { f: 352, amp: 0.02, dec: 6 },   // the boy's boot lands on the step
  { f: 405, amp: 0.03, dec: 7 },   // departure bell, the controller handle slams over
];

// ---------------------------------------------------------------- actors (the contract cast.ts poses against)
export const BOY_KERB = new THREE.Vector3(4.3, 0, -1.6);
/** The boy: at the kerb until he crosses the flooded gutter to board at his doorway (~f = 386). */
export function boyPos(f: number): THREE.Vector3 {
  const t = smootherstep(338, 388, f);
  const step = smoothstep(370, 388, f);
  return new THREE.Vector3(lerp(4.3, 1.62, t), 0.44 * step + 0.18 * Math.max(0, Math.sin(sat((f - 352) / 34) * Math.PI)) * step, lerp(-1.6, -3.62, t));
}
/** The boy's crouch/launch window: he kneels at the kerb and sets the boat on the flood. */
export const crouchAmt = (f: number) => smoothstep(190, 200, f) * (1 - smoothstep(206, 216, f));
/** The lady with the umbrella: crosses the flood left-to-right across shots 3 and 5, at z = -9.5. */
export function ladyPos(f: number): THREE.Vector3 {
  const t = smootherstep(150, 344, f);
  return new THREE.Vector3(lerp(-3.75, 4.35, t), 0, -9.5 + 0.5 * Math.sin(t * 3.1));
}
/** The paper boat: set down at f = 204, then drifting slowly out into the flooded road for the rest of the film.
 *  It is the last thing on screen, so its drift is small but never stops. */
export function boatPos(f: number): THREE.Vector3 {
  if (f < 204) {
    const a = sat((f - 184) / 20);
    return new THREE.Vector3(4.3 - 0.02 * a, lerp(0.78, 0.10, a), lerp(-1.95, -2.4, a));
  }
  const t = sat((f - 204) / 246);
  const e = t * (0.55 + 0.45 * t); // it starts quicker than it finishes
  return new THREE.Vector3(lerp(4.28, 2.9, e), STREET.waterY + 0.011 * Math.sin(f * 0.31) + 0.006 * Math.sin(f * 0.73 + 1.1), lerp(-2.4, -3.5, e));
}
export const boatYaw = (f: number) => 0.34 + f * 0.0055 + 0.12 * Math.sin(f * 0.17) + 0.08 * Math.sin(f * 0.41);
export const boatPhase = (f: number) => clamp((f - 204) / 40, 0, 1); // 0 = in the hand, 1 = floating free
/** The conductor leaning out of the +X side doorway. World z = tramZ(f) + TRAM.doorZ. */
export const doorWorldZ = (f: number) => tramZ(f) + TRAM.doorZ;
export const conductorPos = (f: number): THREE.Vector3 => new THREE.Vector3(TRAM.bodySide + 0.22, 1.06, doorWorldZ(f));

// ---------------------------------------------------------------- camera
type Look = [number, number, number] | ((f: number) => [number, number, number]);
type Key = { f: number; pos: [number, number, number]; look: Look; fov: number; roll: number };
const CAMS: Key[][] = [
  [ // 1 — establishing. High on the pavement, down a flooded canyon, a headlamp 28 m out in the rain.
    { f: 0, pos: [6.55, 3.92, 10.6], look: [0.35, 1.22, -22], fov: 33.0, roll: -1.4 },
    { f: 70, pos: [6.05, 3.34, 8.35], look: [0.22, 1.06, -20], fov: 33.6, roll: -0.7 },
  ],
  [ // 2 — it brakes and pulls up into the near left, the white lamp filling the frame.
    { f: 70, pos: [5.3, 1.9, 8.6], look: [1.0, 1.6, -4.0], fov: 40.0, roll: 0.9 },
    { f: 110, pos: [5.05, 1.78, 7.5], look: [0.5, 1.54, -3.6], fov: 38.2, roll: 0.45 },
    { f: 150, pos: [4.9, 1.72, 6.6], look: [0.2, 1.5, -3.4], fov: 37.0, roll: 0.2 },
  ],
  [ // 3 — the wide lens holds the lit saloon, the boy at the kerb 5 m out, and the lady crossing beyond.
    { f: 150, pos: [5.62, 1.68, 3.4], look: [2.85, 1.02, -3.9], fov: 50.0, roll: -0.5 },
    { f: 200, pos: [5.5, 1.6, 3.0], look: [2.8, 1.0, -4.0], fov: 49.0, roll: -0.3 },
    { f: 248, pos: [5.38, 1.54, 2.5], look: [2.75, 0.99, -4.1], fov: 48.0, roll: -0.2 },
  ],
  [ // 4 — close and low. The lens tracks the boat out across the flooded gutter; the tram's window light
    //     reaches us as a reflection on the water, which is the only way both can share a frame.
    { f: 248, pos: [5.34, 0.46, -1.05], look: (f) => [boatPos(f).x, 0.08, boatPos(f).z], fov: 36.5, roll: 2.3 },
    { f: 292, pos: [5.28, 0.42, -1.35], look: (f) => [boatPos(f).x, 0.07, boatPos(f).z], fov: 35.4, roll: 2.05 },
    { f: 330, pos: [5.2, 0.38, -1.7], look: (f) => [boatPos(f).x, 0.07, boatPos(f).z], fov: 34.6, roll: 1.85 },
  ],
  [ // 5 — the doorway. Wide again: the conductor leaning out, the boy crossing 3.5 m out, the step between.
    { f: 330, pos: [4.92, 1.78, 0.55], look: [1.95, 1.3, -3.25], fov: 44.0, roll: -0.6 },
    { f: 368, pos: [4.86, 1.74, 0.25], look: [1.9, 1.28, -3.3], fov: 43.2, roll: -0.4 },
    { f: 405, pos: [4.8, 1.7, -0.05], look: [1.86, 1.26, -3.35], fov: 42.4, roll: -0.2 },
  ],
  [ // 6 — the tram recedes into the rain. The boat is left bobbing in the near foreground.
    { f: 405, pos: [5.3, 2.02, 3.7], look: [0.35, 1.5, -18], fov: 34.0, roll: 0.8 },
    { f: 450, pos: [5.2, 2.08, 3.95], look: [0.25, 1.46, -18.4], fov: 33.6, roll: 0.5 },
  ],
];

/** Thin-lens DOF per shot: cInf in px at 1080x1920, and where the shot's subject is. */
const DOF: Array<{ cInf: number; focus?: (f: number) => [number, number, number] }> = [
  { cInf: 3.0 },                                                   // 1 wide: nearly all sharp
  { cInf: 8.0, focus: (f) => [0.4, 1.5, tramZ(f) + 4.0] },          // 2 the arriving tram's lit end
  { cInf: 11.0, focus: () => [4.3, 1.02, -1.6] },                   // 3 the boy
  { cInf: 18.0, focus: (f) => [boatPos(f).x, 0.1, boatPos(f).z] },  // 4 the boat
  { cInf: 12.0, focus: (f) => [1.45, 1.3, doorWorldZ(f)] },          // 5 the doorway
  { cInf: 6.0, focus: (f) => [0, 1.55, tramZ(f) + 4.2] },            // 6 the receding tram
];

/** Night grade: the fitted reference curve family (grade.ts) re-fit for a rain-night key. Darks are pressed to
 *  a blue FLOOR that never reaches 0 (QA must never see a black frame), mids stay low, highlights go warm. */
export const NIGHT_GRADE = {
  ky: [0.026, 0.098, 0.232, 0.485, 0.762, 0.915, 1],
  sat: [0.94, 1.04, 1.06] as [number, number, number],
  tintS: [0.033, -0.007] as [number, number], tintM: [0.014, -0.003] as [number, number], tintH: [-0.011, 0.013] as [number, number],
  vig: [0.3, 0.34] as [number, number],
};
export const GRADE_STRENGTH = 1.0;
export const KNOTS = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]; // the grade curve's fixed x knots

export const shotAt = (f: number): number => {
  for (let i = 0; i < SHOTS.length; i++) if (f < SHOTS[i].b) return SHOTS[i].id;
  return SHOTS[SHOTS.length - 1].id;
};

/** Layers to render at frame f (two during a dissolve). Each entry is its own full ThreeCanvas. */
export function layersAt(f: number): Array<{ id: number; alpha: number }> {
  for (const x of XFADE) {
    const a = x.at - x.n / 2, b = x.at + x.n / 2;
    if (f >= a && f < b) { const k = smootherstep(a, b, f); return [{ id: shotAt(x.at - 1), alpha: 1 - k }, { id: shotAt(x.at), alpha: k }]; }
  }
  return [{ id: shotAt(f), alpha: 1 }];
}

const resolve = (l: Look, f: number): [number, number, number] => (typeof l === "function" ? l(f) : l);

/** Camera at frame f: smootherstep glide between the shot's keys, plus the KICKS shake. */
export function camAt(f: number): { pos: THREE.Vector3; look: THREE.Vector3; fov: number; roll: number } {
  const ks = CAMS[shotAt(f) - 1];
  let i = 0;
  while (i < ks.length - 2 && f >= ks[i + 1].f) i++;
  const k0 = ks[i], k1 = ks[Math.min(i + 1, ks.length - 1)];
  const t = k1.f === k0.f ? 0 : clamp((f - k0.f) / (k1.f - k0.f), 0, 1);
  const e = smootherstep(0, 1, t);
  const L = (a: number, b: number) => lerp(a, b, e);
  const pos = new THREE.Vector3(L(k0.pos[0], k1.pos[0]), L(k0.pos[1], k1.pos[1]), L(k0.pos[2], k1.pos[2]));
  const a = resolve(k0.look, f), b = resolve(k1.look, f);
  const look = new THREE.Vector3(L(a[0], b[0]), L(a[1], b[1]), L(a[2], b[2]));
  let roll = L(k0.roll, k1.roll);
  for (const k of KICKS) {
    if (f < k.f || f > k.f + k.dec) continue;
    const d = Math.exp(-(f - k.f) / (k.dec * 0.42)), s = (f - k.f) % 2 === 0 ? 1 : -1;
    pos.x += s * k.amp * d; pos.y -= s * k.amp * 0.62 * d; roll += s * k.amp * 3.0 * d;
  }
  return { pos, look, fov: L(k0.fov, k1.fov), roll };
}

export function dofAt(f: number): { cInf: number; focus?: () => [number, number, number] } {
  const d = DOF[shotAt(f) - 1];
  return { cInf: d.cInf, focus: d.focus ? () => d.focus!(f) : undefined };
}

/** Deterministic per-frame noise for rain, ripples and flicker: a hash of (seed, frame), never Math.random(). */
export const rngAt = (seed: number, f: number) => mulberry32((seed * 73856093) ^ (f * 19349663));
export const FRAMES = TOTAL;
