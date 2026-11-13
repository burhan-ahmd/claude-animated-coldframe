// Timeline of "The Man Who Rode to Victory" (Fred Lorz, 1904 Olympic marathon): shots timed to the voice words
// (new_story/word.txt), the two leads' physics (car position/speed/engine, Fred ride -> stagger -> jog -> tape ->
// victory lap -> the 1905 closing tableau) and the camera grammar copied from the bridge study: symmetric
// smootherstep glides, big reframes are cuts, impacts are 7-frame sign-flipping kicks, no hand-held float.
export const FPS = 30;
export const TOTAL = 945; // 31.500 s
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;

// ---------------- key world meters ----------------
export const CAR_Z = -0.3;         // the car drives on the left of the road centre
export const TAPE_X = 110;         // finish tape spans z +-2.9 at x = 110
export const TAPE_H = 1.05;        // tape attached to the posts at this height
export const BREAK1 = 512;         // Fred hits the tape (first, 1904)
export const BREAK2 = 843;         // ... and again in the 1905 re-run
export const FRED_STOP = 111.91;   // where Fred finally coasts to a stop after the tape

// ---------------- car kinematics (x, z = CAR_Z) ----------------
// arrives at 11.5 m/s, parks off-frame to the left; driver teleports the car back at 10.30 s (hidden by the cut to
// shot 3), Fred drives up at 13.5 m/s and brakes to a stop; after that the engine sputters out.
export const carX = (t: number) => {
  if (t < 5.37) return -34 + 11.5 * t;
  if (t < 10.3) return 27.8;                                   // parked beyond the frame's right edge
  if (t < 11.5) return -52 + 11.8 * smooth((t - 10.3) / 1.2);  // reappears at -40.2, idles
  if (t < 12.33) return -40.2;
  if (t < 14.0) { const u = t - 12.33; return -40.2 + 0.5 * 8.1 * u * u; }       // a = +8.1 -> (-28.9, 13.5)
  if (t < 15.05) { const u = t - 14.0; return -28.9 + 13.5 * u - 0.5 * 12.86 * u * u; } // a = -12.86 -> -21.8
  return -21.8;
};
const teleportT = (t: number) => (t > 10.24 && t < 10.36);
export const carSpeed = (t: number) => {
  if (teleportT(t)) return 0;
  const d = 0.02;
  return Math.max(-26, Math.min(26, (carX(t + d) - carX(t - d)) / (2 * d)));
};
/** engine note (Hz) the audio + exhaust puffs follow; 0 = silent */
export const engineHz = (t: number) => {
  if (t < 5.37) return 15;                       // S1 cruising
  if (t < 10.3) return 0;                        // parked off-frame (shot 2: no car)
  if (t < 11.5) return 14 - 3 * smooth((t - 10.3) / 1.2); // rolls back in, settles to idle
  if (t < 12.33) return 11;                      // idle
  if (t < 14.0) return 12 + 4 * smooth((t - 12.33) / 1.67);  // revs up
  if (t < 15.05) return 16 - smooth((t - 14.0) / 1.05);      // lifts off
  if (t < 15.9) return 14.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * 37)); // sputters, then dies
  return 0;
};

// ---------------- Fred kinematics ----------------
// ride (shot 1) -> stumble clear (shot 2) -> sit and catch his breath (shot 3) -> hops back in and drives off
// (shot 4) -> jogs the last stretch and hits the tape (shot 5) -> stands, is found out (shots 6-8) -> the 1905
// honour lap (shot 9) -> walks off past the abandoned car (shot 10). x jumps at the shot 4->5 and 9->10 xfades.
export const fredX = (t: number) => {
  if (t < 5.36) return carX(t) + 0.30;                                     // riding beside the driver
  if (t < 8.86) return -45.2 + 4.7 * smooth((t - 5.36) / 3.5);             // staggers clear of the car
  if (t < 11.6) return -40.5;                                              // sits on the grass
  if (t < 12.2) return -40.5 - 0.4 * smooth((t - 11.6) / 0.6);             // rises, takes a step
  if (t < 15.1) return carX(t) + 0.30;                                     // climbs in and rides
  if (t < 16.9333) return -21.5 + 2.9 * (t - 15.4);                        // hops out and jogs after the cut
  if (t < 17.067) return 109.61 + 2.9 * (t - 16.9333);                     // S5: the last strides to the tape
  if (t < 18.385) { const u = t - 17.067; return 110 + 2.9 * u - 0.5 * 2.2 * u * u; } // decel 2.2 -> stop at the tape
  if (t < 26.04) return FRED_STOP;                                         // stands in the tape
  if (t < 29.267) return 98.6 + 5.5 * (t - 26.04);                         // 1905 honour lap
  return 70 + 3.2 * (29.633 - t);                                          // S10: walks off left
};
export const fredZ = (t: number) => {
  if (t < 5.36) return CAR_Z + 0.42;
  if (t < 12.2) return 0.9;
  if (t < 12.33) return 0.9 + (0.12 - 0.9) * smooth((t - 12.2) / 0.13);
  if (t < 15.1) return CAR_Z + 0.42;
  if (t < 15.4) return 0.12 + (0.75 - 0.12) * smooth((t - 15.1) / 0.3);
  if (t < 16.9) return 0.75 + (0.3 - 0.75) * smooth((t - 15.4) / 1.5);
  if (t < 26.04) return 0.3;
  if (t < 29.267) return 0.45;
  return 0.35;
};
/** Fred's origin height: 0.72 on the car bench, 0 on foot, with a hop arc when he jumps out in shot 4 */
export const fredY = (t: number) => {
  if (t < 5.36) return 0.72;
  if (t < 12.2) return 0;
  if (t < 12.33) return 0.72 * smooth((t - 12.2) / 0.13);
  if (t < 15.1) return 0.72;
  if (t < 15.4) { const u = (t - 15.1) / 0.3; return 0.72 * (1 - smooth(u)) + 0.35 * Math.sin(Math.PI * u); }
  return 0;
};
export type Mode = "sit" | "stroll" | "jog" | "run" | "stand";
export const fredMode = (t: number): Mode => {
  if (t < 5.36) return "sit";
  if (t < 8.86) return "stroll";
  if (t < 11.6) return "sit";
  if (t < 12.2) return "stroll";
  if (t < 15.1) return "sit";
  if (t < 18.385) return "jog";
  if (t < 26.04) return "stand";
  if (t < 29.267) return "run";
  return "stroll";
};
export type FredExpr = "relief" | "pained" | "neutral" | "grin" | "laugh" | "shock" | "dazed" | "smile";
export const fredExpr = (t: number): FredExpr => {
  const f = t * FPS;
  if (f < 317) return "pained";
  if (f < 423) return "relief";
  if (f < 508) return "neutral";
  if (f < 628) return f >= 576 && f < 606 ? "laugh" : "grin";
  if (f < 703) return f >= 672 ? "shock" : "grin";
  if (f < 749) return "grin";
  if (f < 781) return f >= 764 ? "dazed" : "grin";
  if (f < 878) return "grin";
  return "smile";
};
export const fredSpeed = (t: number) => {
  const d = 0.02;
  return Math.max(0, Math.min(9, (fredX(t + d) - fredX(t - d)) / (2 * d)));
};
/** gait start times per mode change (the march phase is (t - t0) * hz) */
export const GAIT0 = { stagger: 5.36, jog: 15.4, lap: 26.04, walk: 29.267 };
/** footfalls per second per mode: the card cadence the legs swing at in cast.ts */
export const gaitHz = (m: Mode) => (m === "run" ? 3.0 : m === "jog" ? 2.6 : m === "stroll" ? 1.6 : 2.0);
/** march phase at time t for a gait that began at t0: one phase unit = one full stride = two footfalls */
export const phaseAt = (m: Mode, t: number, t0: number) => ((t - t0) * gaitHz(m)) / 2;
/** step length as a multiple of the toon's 0.8 m unit step (foot slip is accepted, as in the bridge study) */
export const stride = (m: Mode) => (m === "run" ? 1.0 : m === "jog" ? 0.95 : m === "stroll" ? 0.6 : 0.8);

// ---------------- the finish straight's furniture ----------------
// world.ts builds it and cast.ts seats the crowd on it, so the numbers live here: a four-tier wooden grandstand
// along the far side of the road (tier 0 = the front row, lowest, nearest the track) with a roof over it, the rope
// barrier in front of it, the judges' table at x 102..106 and the two-post finish tape at TAPE_X.
export const GRAND = { x0: 96, x1: 126, z0: -13.2, dz: 1.35, y0: 0.5, dy: 0.52, tiers: 4, roofY: 5.4 };
/** front edge z and floor height of grandstand tier k (k = 0 is the front row) */
export const grandTier = (k: number) => ({ z: GRAND.z0 - GRAND.dz * k, y: GRAND.y0 + GRAND.dy * k });

// ---------------- the finish tape ----------------
export const tapeBroken = (f: number) => (f >= BREAK1 && f < 781) || f >= BREAK2;
/** 0..1 progress of the current tape fall (0 while the tape is up) */
export const tapeU = (f: number) => clamp01((f - (f >= BREAK2 ? BREAK2 : BREAK1)) / 22);
/** one half of the falling tape: y and z of the loose (centre) end (sign = -1 near post, +1 far post) */
export const tapeEnd = (f: number, sign: number): [number, number] => {
  if (!tapeBroken(f)) return [TAPE_H, 0];
  const u = tapeU(f);
  const z = sign * 2.45 * (1 - Math.exp(-3.5 * u) * Math.cos(5.5 * u));
  const y = TAPE_H - 0.77 * easeOut(u) + 0.06 * Math.exp(-3 * u) * Math.sin(9 * u);
  return [y, z];
};

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type ShotDef = { id: number; a: number; b: number; light: Light; tau: (t: number) => number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 161, light: "day", tau: (t) => t },   // the car arrives, Fred riding, driver at the wheel
  { id: 2, a: 161, b: 317, light: "day", tau: (t) => t }, // he staggers clear of the car and sits
  { id: 3, a: 317, b: 423, light: "day", tau: (t) => t }, // catching his breath, then climbs back in
  { id: 4, a: 423, b: 508, light: "day", tau: (t) => t }, // the car drives off, Fred jogs after it
  { id: 5, a: 508, b: 628, light: "day", tau: (t) => t }, // into the tape: officials, Alice, the wreath
  { id: 6, a: 628, b: 703, light: "day", tau: (t) => t }, // the crowd turns on him
  { id: 7, a: 703, b: 749, light: "day", tau: (t) => t }, // the verdict
  { id: 8, a: 749, b: 781, light: "day", tau: (t) => t }, // the judge raises the hammer
  { id: 9, a: 781, b: 878, light: "golden", tau: (t) => t }, // the 1905 honour lap (time ellipsis)
  { id: 10, a: 878, b: TOTAL, light: "golden", tau: (t) => t }, // walking off past the abandoned car
];
/** crossfades at the place/time ellipses (frames) */
export const XFADE: Record<number, number> = { 5: 8, 9: 8, 10: 8 };

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** layers to draw at frame f: base shot, plus the next shot fading in during a crossfade */
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};
/** light preset for the shot covering frame f */
export const lightAt = (f: number) => shotAt(f).light;

// ---------------- camera ----------------
// Grammar (copied from the bridge study): every move is a symmetric smootherstep glide of 18-40 f; a reframe bigger
// than ~half a frame width is a cut on its key frame; holds push in 0.15-0.35 %/f; impacts kick.
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const T = (f: number) => f / FPS;
const Cx = (f: number) => carX(T(f));
const Fx = (f: number) => fredX(T(f));
/** push-in factor since f0: the subject grows ~rate per frame; `punch` raises it (8 f soft edges) for the first n frames */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k] as V3, look, ...rest });

// ---- framings ----
// shot 1: the car sweeps in from the right; wider -> eye-level -> low -> a punch to its front quarter
const S1a = (f: number) => dolly([Cx(f) - 7, 2.7, 6.0], [Cx(f) + 1.2, 1.1, -0.2], pushK(f, 0, 0.0025), { fov: 44 });
const S1b = (f: number) => dolly([Cx(f) - 0.6, 1.75, 6.8], [Cx(f) + 0.4, 1.25, -0.2], pushK(f, 30, 0.002), { fov: 40 });
const S1c = (f: number) => dolly([Cx(f) - 0.2, 1.15, 5.2], [Cx(f) + 0.5, 1.05, -0.15], pushK(f, 72, 0.0025), { fov: 36 });
const S1d = (f: number) => dolly([Cx(f) + 4.6, 1.35, 3.4], [Cx(f) + 0.7, 1.1, 0.05], pushK(f, 118, 0.002, 0.006, 30), { fov: 36 });
// shot 2: Fred staggers clear, sits down; closer on his face
const S2a = (f: number) => dolly([-35.5, 2.3, 6.2], [-41.5, 0.95, 0.8], pushK(f, 161, 0.0018), { fov: 44 });
const S2b = (f: number) => dolly([-37.4, 1.6, 4.6], [-40.9, 1.05, 0.85], pushK(f, 247, 0.002), { fov: 38 });
const S2c = (f: number) => dolly([-43.6, 1.05, 1.35], [-40.5, 0.8, 0.9], pushK(f, 266, 0.002), { fov: 36 });
// shot 3: he catches his breath, then climbs back into the car
const S3a = (f: number) => dolly([-36.0, 2.2, 6.0], [-40.2, 0.95, 0.2], pushK(f, 317, 0.0018), { fov: 44 });
const S3b = (f: number) => dolly([-37.0, 1.65, 4.7], [-40.1, 1.1, 0.0], pushK(f, 345, 0.002), { fov: 38 });
const S3c = (f: number) => dolly([Cx(f) - 5.0, 1.5, 4.4], [Cx(f) + 0.6, 1.0, -0.1], pushK(f, 373, 0.0018), { fov: 38 });
// shot 4: the car pulls away; Fred hops out and jogs after it
const S4a = (f: number) => dolly([Cx(f) - 5.0, 1.5, 4.4], [Cx(f) + 0.6, 1.0, -0.1], pushK(f, 423, 0.0018), { fov: 38 });
const S4b = (f: number) => dolly([Cx(f) - 4.6, 1.55, 4.3], [Cx(f) + 0.5, 1.05, 0.1], pushK(f, 447, 0.0018), { fov: 38 });
const S4c = (f: number) => dolly([-27.5, 1.75, 5.8], [Fx(f) + 2.2, 0.95, 0.5], pushK(f, 460, 0.002), { fov: 40 });
// shot 5: into the tape (officials, Alice) and the wreath
const S5a = (f: number) => dolly([106.2, 0.85, 4.1], [110, 1.0, 0], pushK(f, 508, 0.002), { fov: 40 });
const S5b = (f: number) => dolly([104.5, 2.6, 8.6], [110.8, 1.0, -1.2], pushK(f, 524, 0.0015), { fov: 44 });
const S5c = (f: number) => dolly([112.0, 1.6, 4.6], [114.55, 1.25, 0.9], pushK(f, 553, 0.002), { fov: 38 });
const S5d = (f: number) => dolly([111.3, 1.5, 6.9], [113.1, 1.1, 0.65], pushK(f, 576, 0.0015), { fov: 38 });
// shot 6: the crowd turns on him (yeller), then his shocked face
const S6a = (f: number) => dolly([110.5, 2.4, 7.4], [114.0, 1.0, -2.0], pushK(f, 628, 0.0018), { fov: 44 });
const S6b = (f: number) => dolly([115.2, 1.5, -3.4], [117.6, 1.35, -7.4], pushK(f, 645, 0.002, 0.005, 24), { fov: 40 });
const S6c = (f: number) => dolly([111.0, 1.55, 2.9], [111.95, 1.42, 0.35], pushK(f, 672, 0.0025), { fov: 34 });
// shot 7: the verdict, tight on Fred
const S7a = (f: number) => dolly([109.6, 1.45, 3.1], [111.95, 1.25, 0.4], pushK(f, 703, 0.002, 0.006, 30), { fov: 38 });
// shot 8: the judge raises the hammer, then Fred's dazed face
const S8a = (f: number) => dolly([104.2, 1.5, 0.6], [104.8, 1.2, -4.2], pushK(f, 749, 0.002, 0.006, 30), { fov: 40 });
const S8b = (f: number) => dolly([110.6, 1.5, 2.6], [111.95, 1.35, 0.35], pushK(f, 764, 0.002), { fov: 36 });
// shot 9: the 1905 honour lap (lens rides with him, then a full run through the tape)
const S9a = (f: number) => dolly([Fx(f) - 4.8, 1.6, 4.2], [Fx(f) + 1.4, 1.05, 0.45], pushK(f, 781, 0.0018), { fov: 42 });
const S9b = (f: number) => dolly([106.9, 1.5, 4.6], [110.4, 1.0, 0.45], pushK(f, 846, 0.002), { fov: 38 });
// shot 10: he walks off left past the abandoned, rusted car
const S10a = (f: number) => dolly([Fx(f) - 5.2, 1.55, 4.0], [Fx(f) - 0.8, 0.95, 0.35], pushK(f, 878, 0.0018), { fov: 40 });
const S10b = (f: number) => dolly([63.0, 1.7, 6.0], [70.5, 1.05, 0.8], pushK(f, 899, 0.001), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: S1a },
    { f: 30, dur: 37, s: S1b },   // settles to eye level as the car parks
    { f: 72, dur: 32, s: S1c },   // low on the sill
    { f: 118, dur: 26, s: S1d },  // punch: the front quarter
  ],
  2: [
    { f: 161, s: S2a },           // cut: he's already clear of the car
    { f: 247, dur: 20, s: S2b },
    { f: 266, cut: true, s: S2c },
  ],
  3: [
    { f: 317, s: S3a },
    { f: 345, dur: 24, s: S3b },
    { f: 373, cut: true, s: S3c }, // cut as he climbs in
  ],
  4: [
    { f: 423, s: S4a },           // no cut at the shot 3 -> 4 boundary: keeps tracking the car
    { f: 447, dur: 20, s: S4b },  // settles as the car brakes
    { f: 460, dur: 24, s: S4c },  // swings onto Fred jogging away
  ],
  5: [
    { f: 508, s: S5a },           // cut (place ellipsis, xfaded): the tape ahead
    { f: 524, dur: 22, s: S5b },
    { f: 553, dur: 22, s: S5c },
    { f: 576, dur: 26, s: S5d },
  ],
  6: [
    { f: 628, s: S6a },
    { f: 645, cut: true, s: S6b }, // cut to the yeller
    { f: 672, cut: true, s: S6c }, // cut to Fred's shock
  ],
  7: [{ f: 703, s: S7a }],
  8: [
    { f: 749, s: S8a },           // cut to the judge
    { f: 764, cut: true, s: S8b }, // cut to Fred
  ],
  9: [
    { f: 781, s: S9a },           // xfade in (place engulfed by light)
    { f: 846, cut: true, s: S9b },
  ],
  10: [
    { f: 878, s: S10a },          // xfade in
    { f: 899, cut: true, s: S10b }, // cut to the closing tableau
  ],
};

// impact kicks (reference v14): image offset flips sign every frame (~3 px per unit), decays in 7 f; roll +-0.23 deg/unit
const KICKS: [number, number][] = [[512, 1.0], [645, 0.6], [763, 1.0], [843, 1.0]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [kf, g] of KICKS) {
    const n = Math.floor(t * FPS + 1e-6) - kf;
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(d[0], d[1], d[2]), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
/** frame at which the current key's move has finished (for picking billboard views per key) */
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens: depth of field ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const carFocus = (dx: number, y: number, dz: number) => (f: number): V3 => [Cx(f) + dx, y, dz];
export const DOF: Dof[] = [
  { f: 0, cInf: 0 },
  { f: 30, cInf: 8, focus: carFocus(0.3, 1.5, 0.12) },
  { f: 72, cInf: 12, focus: carFocus(0.3, 1.5, 0.12) },
  { f: 118, cInf: 14, focus: carFocus(1.5, 0.95, -0.3) },
  { f: 161, cInf: 0 },
  { f: 247, cInf: 12, focus: (f) => [Fx(f), 1.35, 0.9] },
  { f: 266, cInf: 14, focus: () => [-40.5, 0.85, 0.9] },
  { f: 317, cInf: 0 },
  { f: 345, cInf: 12 },
  { f: 373, cInf: 8 },
  { f: 447, cInf: 12, focus: carFocus(0.5, 1.05, 0.1) },
  { f: 460, cInf: 12, focus: (f) => [Fx(f), 1.0, 0.5] },
  { f: 508, cInf: 10, focus: (f) => [Fx(f), 1.1, 0.35] },
  { f: 524, dur: 22, cInf: 6 },
  { f: 553, cInf: 12, focus: () => [114.55, 1.3, 0.95] },
  { f: 576, cInf: 8, focus: () => [113.0, 1.2, 0.6] },
  { f: 628, cInf: 6 },
  { f: 645, cInf: 13, focus: () => [117.6, 1.4, -7.6] },
  { f: 672, cInf: 14, focus: () => [111.91, 1.42, 0.3] },
  { f: 703, cInf: 12, focus: () => [111.91, 1.3, 0.3] },
  { f: 749, cInf: 12, focus: () => [104.8, 1.35, -4.55] },
  { f: 764, cInf: 13, focus: () => [111.91, 1.4, 0.3] },
  { f: 781, cInf: 8 },
  { f: 846, cInf: 12, focus: () => [110.6, 1.05, 0.45] },
  { f: 878, cInf: 8 },
  { f: 899, cInf: 6, focus: () => [70.0, 1.0, 1.5] },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
/** what the lens focuses on (DOF): the DOF table's focus point, else the camera look point */
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};
