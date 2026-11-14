// ===================================================================================================================
// "Pip and the Noon Bell" — the shot list. Eight shots on one street (contract.ts owns the subject: Pip's path, the
// cake, the bell), and the camera grammar measured in the reference study (references/reports/motion.md):
//   * every move is a symmetric smootherstep glide (attack == release, ~10 f in / 10 f out) of 18-40 f, with a peak
//     near 14-25 px/f at 720p (peak = 1.875 x distance / dur, so dur >= 0.075 x the move in 720p px);
//   * a reframe bigger than about half a frame width or 40 % zoom is a HARD CUT on its key frame — so the keys of one
//     shot only ever shift the lens a couple of metres, and every big change of side or distance is `cut: true`;
//   * holds PUSH IN (0.15-0.35 %/f; ~0.6 %/f for ~35 f on a punch beat), they never slide sideways;
//   * emphasis rolls are 4-8 deg glided over >= 18 f, and a held dutch stays <= 0.05 rad;
//   * impacts are 7-frame kicks that flip sign every frame (motion.md 5.1c) — there is NO hand-held float;
//   * lens blur is a thin lens (references/reports/depth.md): on in about a third of the shots (a fourth of the screen
//     time, all of it mild), off for the establishing and the big open framings, and a near framing object covers part
//     of one frame edge in about a fifth of the frames (FOREGROUND below; world.ts builds them).
// The lens varies as depth.md 4.2 asks: 0.5-0.6 m low beats (shot 7 at the tower, shot 3 under the cart), a high
// crane over the church square, one 32 deg long-lens compression, close-ups on the cake (shot 5, shot 8) and on
// faces (shot 2, shot 5, shot 8).
// This file imports only ./contract (and nothing else): it is the layout root for the film.
// ===================================================================================================================
import {
  FPS, TOTAL, tOf, glide, streetY, pipZ, pipX, pipMode, chestOf, SHOT_TIME, shotIndexAt,
  BELL_AT, BELL_STRIKE, WATER_Y,
} from "./contract";
import type { V3, Fg, Cam, ShotTime } from "./contract";

export { FPS, TOTAL } from "./contract";
export type { Cam } from "./contract";

// ---------------- time, shots, crossfades ----------------
export const shotAt = (f: number): ShotTime => SHOT_TIME[shotIndexAt(f)];

/** crossfade frames at a cut (reference grammar 6-8): the places are 6-34 m apart and the light never changes, so
 *  every cut is a short dissolve of the two stacked canvases rather than a white flash. */
export const XFADE: Record<number, number> = { 2: 6, 3: 6, 4: 8, 5: 6, 6: 7, 7: 6, 8: 8 };

/** layers to draw at frame f: the base shot, plus the next shot fading in during a crossfade (bridge/story.ts) */
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOT_TIME) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- the subject, as the camera sees it ----------------
// Units note: contract.ts is not consistent about what it passes to its own Pip functions. PIP_TZ is keyed by FRAMES
// (its keys are exactly SHOT_TIME's a/b: 0, 118, 250, ... 900, and the shot table in the brief gives Pip's z per shot
// as z 34 -> 26 over frames 0-118), while pipX / pipMode / bakerSpot / boatmanZ / bellAngle use SECONDS (pipX's two
// windows are the market, t < 8.3 s, and the lane, 8.3-12.3 s = frames 249-369). The camera therefore reads pipZ in
// frames and pipX in seconds: that is the only reading under which Pip both walks the street and weaves through the
// market. Pip's lateral swing only sets where the lens aims by a few tenths of a metre, so the framing survives
// either reading; his z is what the whole film depends on. Pip's lateral swing is read through a smoothed helper
// (below) because contract.pipX steps at its two window edges.
const Pz = (f: number) => pipZ(f);
const Py = (f: number) => streetY(pipZ(f));
const clampf = (f: number) => (f < 0 ? 0 : f > TOTAL ? TOTAL : f);
/** Pip's lateral weave, read through a symmetric 17-frame average. contract.pipX switches its two sines on and off at
 *  t = 8.3 s (frame 249) and t = 12.3 s (frame 369) without cross-fading, so it STEPS ~1.06 m and ~0.9 m inside one
 *  frame there. The average turns each step into a smooth half-second side-step for the lens (contract.ts is frozen,
 *  so this defends the CAMERA from it rather than editing the subject; world.ts / cast.ts read pipX directly). */
const Px = (f: number) => {
  let s = 0;
  for (let i = -8; i <= 8; i++) s += pipX(tOf(clampf(f + i)));
  return s / 17;
};
const chest = (f: number): V3 => chestOf([Px(f), Py(f), Pz(f)]);
/** the cake, read the same way: it rides at Pip's chest a little in front. (contract.cakePos would read its own z in
 *  seconds and place the cake 80 m back up the street, so the shot-5 / shot-8 close-ups would focus on empty market.) */
const cake = (f: number): V3 => {
  const m = pipMode(tOf(f));
  return [Px(f), Py(f) + (m === "climb" ? 1.05 : 1.18), Pz(f) - (m === "present" ? 0.55 : 0.34)];
};
/** the CARRIED cake, with pipMode held at "carry". contract.pipMode is a step function and the camera aims at what it
 *  returns, so every one of its steps is a lens jump: 20.6 s (frame 618, carry -> climb, 0.13 m) is inside shot 5 and
 *  would snap the frame 4.3 deg in the shot's last two frames. Shot 5 is a carry from end to end, so it reads this
 *  instead (a camera defence, like Px above: cast.ts still builds the cake where pipMode says); shot 8 wants the
 *  "present" cake and its one step, at 29.0 s, is the frame the shot-8 cut sits on. */
const cakeCarry = (f: number): V3 => [Px(f), Py(f) + 1.18, Pz(f) - 0.34];
/** a lens point: x, z, and `h` metres above the street surface at that z (the surface, never a bare y = 0) */
const over = (x: number, z: number, h: number): V3 => [x, streetY(z) + h, z];

// ---------------- camera machinery (bridge/story.ts, unchanged) ----------------
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
const mixCam = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mixCam(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
/** push-in factor since f0: the subject grows ~rate per frame; `punch` raises it (8 f soft edges) for n frames */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
/** dolly push: the camera slides toward the look point by factor k */
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
/** zoom push: the lens stays put, tan(fov/2) shrinks by k (used for the long-lens shot, where moving the lens would
 *  change the perspective that makes the shot: a compression stays a compression) */
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });

// Every look point below is solved so the framed subject lands on a chosen spot in the frame (see the numbers after
// each "at"): a subject held dead centre for 30 s reads as a graphics test, so most keys put him 40-150 px off centre
// and let the street or the sky carry the other side of the frame.

// ---- shot 1 (0-118, bakery, z 34 -> 26): open on the shop from his left-rear, then one slow push rides with him ----
// S1a: 3/4 from his left-rear, 7.5 m out and 1.47 m up — the shop front and the street ahead of him, the cake in both
// hands. A slow 0.18 %/f push under the whole first beat.
const S1a = (f: number) => dolly(over(Px(f) - 7.2, Pz(f) + 1.92, 1.47), [Px(f) + 0.05, Py(f) + 1.05, Pz(f) + 0.25], pushK(f, 0, 0.0018), { fov: 41, roll: 0.02 });
// S1b: the SAME bearing, pushed in 1.6x to 4.7 m and down to 1.35 m as the baker waves him off. Because the bearing
// does not change this is a pure push-in (+64 % size, peak 22 px/f), never a swing around him: the calmest open.
const S1b = (f: number) => dolly(over(Px(f) - 4.5, Pz(f) + 1.2, 1.35), [Px(f), Py(f) + 1.10, Pz(f) + 0.10], pushK(f, 44, 0.0022), { fov: 40, roll: -0.02 });

// ---- shot 2 (118-250, market, z 26 -> 6): the busiest composition — riding wide behind him, then a front-3/4 MS ----
// S2a: over his left shoulder through the stalls, bunting overhead, the crowd between the lens and him.
const S2a = (f: number) => dolly(over(Px(f) - 3.9, Pz(f) + 4.2, 1.65), [Px(f) + 0.25, Py(f) + 1.40, Pz(f) + 0.20], pushK(f, 118, 0.0018), { fov: 44, roll: -0.02 });
// S2b: CUT to the front 3/4 right as he weaves out of the crowd, the geese strung out behind him (the swap is bigger
// than half a frame width, so it is a cut on the key frame, not a glide).
const S2b = (f: number) => dolly(over(Px(f) + 3.4, Pz(f) - 6.4, 1.45), [Px(f) + 0.30, Py(f) + 1.15, Pz(f) + 0.15], pushK(f, 178, 0.002), { fov: 40, roll: 0.03 });
// S2c: the same bearing, a step nearer and lower with the geese swinging past the lens in front; 0.6 %/f for 32 f
// (the film's first punch — a PUSH, not a reframe) and a 3.7 deg roll back through level.
const S2c = (f: number) => dolly(over(Px(f) + 2.9, Pz(f) - 5.4, 1.12), [Px(f) + 0.25, Py(f) + 1.10, Pz(f) + 0.10], pushK(f, 214, 0.003, 0.006, 32), { fov: 39, roll: -0.035 });

// ---- shot 3 (250-368, the lane, z 6 -> -10): the cart blocks the way and he ducks under the axle ----
// The three keys sit behind his right elbow; the look point is a little low and ahead of him, which keeps him
// right-of-centre with the lane and the cart's underside opening on the left. Every key holds him at x +120..+150,
// so the two glides reframe by <50 px and the only real move is the drop from 1.15 m to 0.50 m.
// S3a: low 3/4 behind his right elbow as the lane narrows (1.15 m — the walls close in on the frame).
const S3a = (f: number) => dolly(over(Px(f) - 3.0, Pz(f) + 3.0, 1.15), [Px(f) - 0.30, Py(f) + 1.05, Pz(f) - 0.25], pushK(f, 250, 0.0018), { fov: 44, roll: 0.02 });
// S3b: the glide drops the lens to 0.62 m and dollies a metre in: the lane floor, the cart's underside ahead, his
// boots at the bottom of the frame (the whole figure, seen from 0.6 m).
const S3b = (f: number) => dolly(over(Px(f) - 3.2, Pz(f) + 2.7, 0.62), [Px(f) - 0.20, Py(f) + 1.05, Pz(f) - 0.25], pushK(f, 300, 0.0022), { fov: 44, roll: -0.03 });
// S3c: 0.50 m — the lowest lens in the film — one step wider in frame, ducking under the axle: punch push (0.5 %/f
// for 28 f) and a 4 deg roll the other way.
const S3c = (f: number) => dolly(over(Px(f) - 2.9, Pz(f) + 2.4, 0.50), [Px(f) - 0.20, Py(f) + 1.00, Pz(f) - 0.25], pushK(f, 334, 0.003, 0.005, 28), { fov: 45, roll: 0.04 });

// ---- shot 4 (368-500, the bridge, z -10 -> -44): he crosses. Big open composition ----
// S4a: one lens 1.75 m over the water, 18.5 m out from the span, panning with him across the whole crossing: the deck
// in profile, quays, water and far bank. The lens z sits 5.5 m OFF the boat's rowing line — the boat crosses at
// z = Z_RIVER = -22 and at z -22 the boatman's hull filled the lens at f ~390-435 (run-2 defect D); peak pan ~22 px/f.
const S4a = (f: number) => dolly([18.5, WATER_Y + 1.75, -27.5], [Px(f), Py(f) + 1.15, Pz(f)], pushK(f, 368, 0.0012), { fov: 43, roll: -0.02 });
// S4b: CUT down to 0.92 m on the far half of the deck, ahead of him, a 3/4 as he walks the last of the span at the lens.
const S4b = (f: number) => dolly(over(Px(f) - 3.6, Pz(f) - 5.4, 0.92), [Px(f) + 0.20, Py(f) + 1.15, Pz(f) - 0.15], pushK(f, 448, 0.002), { fov: 44, roll: 0.03 });

// ---- shot 5 (500-620, the climb, z -44 -> -58): up the ramp, the cake tilts, he saves it ----
// S5a: 3/4 from above the ramp, on the terrace side, looking down the slope as he climbs toward the lens.
const S5a = (f: number) => dolly(over(Px(f) + 3.4, Pz(f) - 5.4, 1.15), [Px(f) - 0.05, Py(f) + 0.75, Pz(f) - 0.10], pushK(f, 500, 0.0018), { fov: 42, roll: 0.025 });
// S5b: CUT to the cake — 1.8 m out on his front-left, 36 deg: the cake sits just under the centre of the frame and
// his head is the top of it. The lens keeps a FIXED offset from the cake, so the next key can pull straight back off
// the same axis instead of swinging round him. It rides with Pip (1.66 m over his feet, not over the ramp's own
// surface) for the same reason: a fixed offset is what makes the pull-back a pure dolly (a ground-relative height
// would drift 0.31 m against the cake as the ramp flattens and smear the frame sideways at 1.8 m).
const S5bP = (f: number): V3 => [Px(f) - 0.75, Py(f) + 1.66, Pz(f) - 1.80];
const S5b = (f: number) => dolly(S5bP(f), cakeCarry(f), pushK(f, 556, 0.0018), { fov: 36, roll: -0.035 });
// S5c: the save — the lens retreats 1.45x ALONG S5b's own axis (the SAME look point, so the camera only glides away
// from it: never a swing around him) out to 2.4 m, and his face and the cake come back together. Punch push (0.5 %/f
// for 30 f) and a 4.3 deg roll to level. Because both keys frame the cake, the whole move is one straight line out.
const S5c = (f: number) => dolly(S5bP(f), cakeCarry(f), 1.55 * pushK(f, 588, 0.003, 0.005, 30), { fov: 37, roll: 0.04 });

// ---- shot 6 (620-742, the church square, z -58 -> -72): the guests gather, the tower looms ----
// S6a: the long lens — 32 deg from 10 m back down the climb: guests, square and tower stacked flat, a slow pan and a
// 0.2 %/f fov push that never changes the compression.
const S6a = (f: number) => zoom(over(Px(f) + 5.0, Pz(f) + 9.0, 2.6), [Px(f) + 0.25, Py(f) + 1.30, Pz(f) - 0.15], 32, pushK(f, 620, 0.002), { roll: -0.015 });
// S6b: CUT up: the crane hangs 4.1 m over the square and looks down as the guests close in around him.
const S6b = (f: number) => dolly(over(Px(f) + 5.2, Pz(f) + 3.0, 4.10), [Px(f) + 0.05, Py(f) + 1.05, Pz(f) + 0.05], pushK(f, 670, 0.0016), { fov: 40, roll: 0.02 });
// S6c: the crane eases down 1.15 m over 40 f (a 10 deg tilt, not a whip) to 2.95 m above the guests; punch push and a
// 3.7 deg roll back through level.
const S6c = (f: number) => dolly(over(Px(f) + 4.9, Pz(f) + 2.85, 2.95), [Px(f) + 0.05, Py(f) + 1.05, Pz(f)], pushK(f, 702, 0.003, 0.005, 30), { fov: 39, roll: -0.045 });

// ---- shot 7 (742-834, the bell, z -72 -> -76): the low sun-behind angle up the tower ----
// S7a: THE low shot — the lens sits low at Pip's right, 1 m over the terrace, and the look point is the BELFRY
// itself (x -7.2, opening y 10.2..14.4 — a full street block left of the lane). ~26 deg up: the bell mouth lands
// just above frame centre, Pip's head-and-shoulders hold the lower right. The belfry anchor is FIXED (the tower
// does not move; the lens drifts with Pip, the pan stays ~2 px/f). The old Pip-relative look (2.7 m up the lane)
// framed blank nave wall — the campanile never entered the frame (run-2 defect C).
const S7a = (f: number) => dolly(over(Px(f) + 6.0, Pz(f) + 6.0, 1.0), [-5.0, 8.2, -75.5], pushK(f, 742, 0.002), { fov: 45, roll: -0.03 });
// S7b: same rig, a step nearer, the look easing up to the bell mouth as the first swing runs; 3 deg roll.
const S7b = (f: number) => dolly(over(Px(f) + 5.4, Pz(f) + 5.4, 1.15), [-4.7, 9.4, -75.7], pushK(f, 776, 0.0022), { fov: 43, roll: 0.02 });
// S7c: still the same rig on the run to the door — a last small rise, the look settling onto the bell for the strike.
const S7c = (f: number) => dolly(over(Px(f) + 5.0, Pz(f) + 5.0, 1.3), [-4.4, 10.2, -75.9], pushK(f, 810, 0.0025), { fov: 42, roll: -0.045 });

// ---- shot 8 (834-900, the church door, z -76 -> -82): the cake is presented as the bell strikes (29.1 s) ----
// S8a: warm 3/4 from in front of the church as he comes the last yards with the guests behind him.
const S8a = (f: number) => dolly(over(Px(f) - 3.2, Pz(f) - 4.0, 1.35), [Px(f) - 0.05, Py(f) + 1.10, Pz(f) + 0.05], pushK(f, 834, 0.002), { fov: 42, roll: 0.02 });
// S8b: CUT to the cake — the tiers held out at the door (pipMode turns "present" at 29.0 s = frame 870 and the cake
// steps 0.21 m forward in one frame; the cut is ON that frame, so no shot ever contains the step), 36 deg, and the
// strike's kicked frame (29.1 s = 873) lands 3 frames in. 1.8 m out: the cake at the centre, his head inside the top.
const S8bP = (f: number): V3 => [Px(f) - 0.80, Py(f) + 1.25, Pz(f) - 2.20];
const S8b = (f: number) => dolly(S8bP(f), cake(f), pushK(f, 870, 0.0018), { fov: 36, roll: -0.045 });
// S8c: the last move — the lens retreats 1.44x ALONG S8b's own axis (the SAME look point) to 2.65 m: Pip and the cake
// in the doorway, both sharp, the push carrying to the last frame while a 4 deg roll settles through level.
const S8c = (f: number) => dolly(S8bP(f), cake(f), 1.45 * pushK(f, 878, 0.0018), { fov: 37, roll: 0.02 });

/** One key list per shot (ids 1-8). A key either glides (dur 18-40, symmetric smootherstep) or hard cuts. */
const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 44, dur: 40, s: S1b }],
  2: [{ f: 118, s: S2a }, { f: 178, cut: true, s: S2b }, { f: 214, dur: 30, s: S2c }],
  3: [{ f: 250, s: S3a }, { f: 300, dur: 34, s: S3b }, { f: 334, dur: 30, s: S3c }],
  4: [{ f: 368, s: S4a }, { f: 448, cut: true, s: S4b }],
  5: [{ f: 500, s: S5a }, { f: 556, cut: true, s: S5b }, { f: 588, dur: 30, s: S5c }],
  6: [{ f: 620, s: S6a }, { f: 670, cut: true, s: S6b }, { f: 702, dur: 40, s: S6c }],
  7: [{ f: 742, s: S7a }, { f: 776, dur: 34, s: S7b }, { f: 810, dur: 24, s: S7c }],
  8: [{ f: 834, s: S8a }, { f: 870, cut: true, s: S8b }, { f: 878, dur: 22, s: S8c }],
};

// impact kicks (reference v14): the image offset flips sign every frame (~3 px at 720p per unit), decays to 0 in
// 7 f, roll +-0.23 deg per unit. The bell's first swing, the cake landing, and the noon strike itself (29.1 s).
const KICKS: [number, number][] = [[BELL_AT, 0.5], [29.0, 0.6], [BELL_STRIKE, 1.0]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(tOf(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a; // metres at the look distance for 3 px x a
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
/** frame at which the current key's move has finished (for picking billboard views per key, not per frame) */
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens: depth of field ----------------
/** Lens blur per shot (thin lens). cInf = blur-disc radius in px at 1080x1920 for things at infinity; 0 = all sharp.
 *  Reference (depth.md 1.2): DOF on in about 1/3 of shots; when on, background sigma720 CU 4.2, MS 4.0, FS 2.7,
 *  WS 1.9 (disc radius at 1080p = 3 x sigma720); near objects 4-8 sigma. Establishing and wide shots stay sharp,
 *  and a focus change happens only on a cut or ramps with the camera move it shares f/dur with (depth.md 6.6).
 *  Values on cut frames carry no `dur`; values on glide keys ramp with them. focus = world point (else the look). */
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 0 }, // open on the shop: the establishing framing stays sharp
  { f: 44, dur: 40, cInf: 10, focus: chest }, // the walk-off MS, ramping in with the glide (~8 px, FS class)
  { f: 118, cInf: 0 }, // the market is the busiest frame in the film: kept readable
  { f: 250, cInf: 13, focus: chest }, // the lane (MS)
  { f: 334, dur: 30, cInf: 15, focus: chest }, // the very low duck under the axle (near foreground cart)
  { f: 368, cInf: 0 }, // the open bridge panorama: sharp
  { f: 448, cInf: 9, focus: chest }, // the low deck 3/4 on the far half of the span
  { f: 500, cInf: 0 }, // the climb wide
  { f: 556, cInf: 13, focus: cakeCarry }, // the cake close-up as it tilts
  { f: 588, dur: 30, cInf: 11, focus: cakeCarry }, // the recovery: the pull-back keeps the cake sharp, Pip 0.3 m behind
  { f: 620, cInf: 0 }, // the long lens over the square: sharp, the haze does the depth
  { f: 742, cInf: 6, focus: chest }, // low at the tower foot: mild
  { f: 812, cInf: 0 }, // the run at the bell: sharp
  { f: 870, cInf: 12, focus: cake }, // the presented cake (cut, CU)
  { f: 878, dur: 22, cInf: 8, focus: cake }, // the pull-back to the doorway: warm, a little soft
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
/** what the lens focuses on: the DOF table's point, else the camera's look point (the composer's default) */
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};

// ---------------- near framing objects (depth.md 6.3): blurred foreground, ~20 % of frames ----------------
/** visible while a <= f < b; `crate` = a GLB name from public/bridge/kenney (build.ts kitClone); x/y/z = the base
 *  point (the model's base sits on y). Each sits at 0.3-0.5 x the focus distance of the framing it belongs to, and
 *  covers 10-25 % of one frame edge without ever crossing a face: the bakery bread table at the frame's bottom-left
 *  under S1a, a market bench in the bottom of the riding wide S2a, and a hand cart below Pip's boots on S4b.
 *  world.ts builds them (never through prop()'s sight-line test) and toggles them by the frame range. */
export const FOREGROUND: Fg[] = [
  { a: 0, b: 64, crate: "stall-bench", x: -2.55, y: 0, z: 35.4, s: 0.95, yaw: 0.42 },
  { a: 118, b: 158, crate: "stall-bench", x: -2.48, y: 0, z: 28.22, s: 1.0, yaw: -0.5 },
  { a: 448, b: 500, crate: "cart", x: -2.55, y: 0, z: -39.3, s: 0.6, yaw: 0.5 },
];

// ---------------- dressing (kit GLB names, public/bridge/kenney) ----------------
/** Static dressing off the walkable street (|x| > 5.5 where the street is the only flat ground): trees, bushes,
 *  flowers, lanterns, market canvas and banners, kept 6-10 m out so they read as depth layers behind the stalls and
 *  the houses and haze out at the skyline. y = the base, on the street surface at that z (streetY), which is right
 *  for the shelf beside the street; world.ts may re-seat any of them on its own terrain. */
export const BACKGROUND: { kit: string; x: number; y: number; z: number; s: number; yaw?: number }[] = [
  // bakery (z 26..38): the trees and flower boxes that flank the shop
  { kit: "tree_default", x: -8.6, y: streetY(33), z: 33, s: 5.5, yaw: 0.4 },
  { kit: "plant_bushDetailed", x: 7.2, y: streetY(31), z: 31, s: 1.2, yaw: 1.2 },
  { kit: "flower_redA", x: 6.4, y: streetY(35), z: 35, s: 0.6, yaw: 0.2 },
  { kit: "flower_yellowA", x: -6.8, y: streetY(36.5), z: 36.5, s: 0.6, yaw: 2.1 },
  { kit: "lantern", x: -6.2, y: streetY(29), z: 29, s: 2.6, yaw: -1.6 },
  // market square (z 6..26): stalls, bunting and trees behind the aisles
  { kit: "stall-bench", x: 6.7, y: streetY(20), z: 20, s: 1.4, yaw: -1.55 },
  { kit: "hedge", x: -6.7, y: streetY(16), z: 16, s: 1.3, yaw: 1.55 },
  { kit: "flower_yellowA", x: 6.5, y: streetY(12), z: 12, s: 0.6, yaw: -0.2 },
  { kit: "grass", x: -7.1, y: streetY(9.5), z: 9.5, s: 0.45, yaw: 0.2 },
  { kit: "plant_bushLarge", x: 8.2, y: streetY(22.5), z: 22.5, s: 1.5, yaw: 0.9 },
  { kit: "grass_large", x: -7.6, y: streetY(23), z: 23, s: 0.5, yaw: 0.3 },
  { kit: "tree_cone", x: 9.4, y: streetY(8), z: 8, s: 4.5, yaw: 1.1 },
  { kit: "tree-high-round", x: -9.2, y: streetY(19), z: 19, s: 5.0, yaw: 2.4 },
  // the lane (z -10..6): one lantern a side, a hedge and a bush at the walls
  { kit: "lantern", x: -6.1, y: streetY(3.5), z: 3.5, s: 2.6, yaw: -1.6 },
  { kit: "lantern", x: 6.1, y: streetY(-5), z: -5, s: 2.6, yaw: 1.6 },
  { kit: "hedge", x: -6.4, y: streetY(-1), z: -1, s: 1.3, yaw: 0.05 },
  { kit: "plant_bush", x: 6.3, y: streetY(-8), z: -8, s: 1.1, yaw: 0.7 },
  // the quays either end of the bridge (the span itself stays clear: water and far bank)
  { kit: "tree_detailed", x: -8.5, y: streetY(-10), z: -10, s: 5.0, yaw: 0.6 },
  { kit: "tree_fat", x: 8.8, y: streetY(-11), z: -11, s: 5.0, yaw: 2.2 },
  { kit: "grass", x: 6.2, y: streetY(-33.5), z: -33.5, s: 0.45, yaw: 0.4 },
  { kit: "flower_purpleA", x: -6.2, y: streetY(-34.5), z: -34.5, s: 0.6, yaw: 1.4 },
  { kit: "lily_large", x: 7.4, y: WATER_Y + 0.03, z: -19.5, s: 1.2, yaw: 0.8 },
  { kit: "lily_large", x: -8.1, y: WATER_Y + 0.03, z: -26.5, s: 1.3, yaw: 2.6 },
  // the climb (z -44..-58): trees on both shelves above the retaining walls
  { kit: "plant_bushDetailed", x: 6.6, y: streetY(-47), z: -47, s: 1.3, yaw: 0.9 },
  { kit: "flower_yellowA", x: -6.0, y: streetY(-46.5), z: -46.5, s: 0.6, yaw: 0.3 },
  { kit: "tree_cone", x: -8.4, y: streetY(-50), z: -50, s: 4.0, yaw: 1.8 },
  { kit: "tree_oak", x: 8.8, y: streetY(-54), z: -54, s: 5.5, yaw: 0.2 },
  // the church square (z -58..-72): the square is wide, so the dressing steps out to 7-10 m
  { kit: "lantern", x: -6.6, y: streetY(-60), z: -60, s: 2.8, yaw: -1.6 },
  { kit: "tree-high-round", x: -9.6, y: streetY(-62), z: -62, s: 5.5, yaw: 2.9 },
  { kit: "hedge", x: 7.5, y: streetY(-64), z: -64, s: 1.3, yaw: -0.05 },
  { kit: "tree_default", x: 9.0, y: streetY(-66), z: -66, s: 5.0, yaw: 1.2 },
  { kit: "lantern", x: 6.6, y: streetY(-70), z: -70, s: 2.8, yaw: 1.6 },
  { kit: "flower_redA", x: -6.4, y: streetY(-71), z: -71, s: 0.6, yaw: 0.6 },
  // the tower and the church door (z -74..-88)
  { kit: "tree-high-round", x: 7.8, y: streetY(-74), z: -74, s: 4.5, yaw: 1.5 },
  { kit: "plant_bushLarge", x: -6.9, y: streetY(-78), z: -78, s: 1.5, yaw: 0.4 },
  { kit: "plant_bushDetailed", x: 6.9, y: streetY(-80), z: -80, s: 1.2, yaw: 2.0 },
  { kit: "lantern", x: -6.3, y: streetY(-84), z: -84, s: 2.8, yaw: -1.6 },
];
