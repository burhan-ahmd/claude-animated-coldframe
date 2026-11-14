// Continuous "zoom-through" camera: one unbroken move that travels from subject A to subject B to subject C
// inside the same 3D world, with no cut. Use it instead of three separate shots (tower / crowd / hero).
//
//   import {flow, flowFocus, lookFrom} from './flow';
//   const TOWER = lookFrom([0, 150, 0], 160, 20, 8);          // wide of the tower
//   const CROWD = lookFrom([6, 1.4, 12], 5, -25, 4);          // the broke people at its foot
//   const HERO  = lookFrom([8, 1.5, 12.5], 2.2, -10, 2);      // one worried face
//   const cam = flow([
//     {f: 0,   ...TOWER, hold: 20},                           // settle on the tower, slow push-in
//     {f: 58,  ...CROWD, hold: 24, focus: [6, 1.2, 12]},      // travel DOWN to the crowd (58 f), settle
//     {f: 118, ...HERO,  hold: 30, focus: [8, 1.6, 12.5]},    // travel to one face, settle
//   ]);
//   // in story.ts:  CAMS[7] = [{f: 0, cut: true, s: cam}];  (one key; `cam` returns {pos, look, fov, roll})
//   // DOF:          { f: 0, cInf: 12, focus: flowFocus(stops) }   // rack focus follows the stops
//
// The path is a cubic Hermite spline through the stops, so the camera glides on a curve with continuous speed
// (no stop-start jerks between segments). Each stop is either a place to settle (pass = 0, default; ease in and out,
// then a creeping push-in during `hold`) or a point to fly through at speed (pass = 1).
export type V3 = [number, number, number];
export type Cam = {pos: V3; look: V3; fov: number; roll: number};

export type Stop = {
  /** frame on which the camera ARRIVES at this subject */
  f: number;
  pos: V3;
  look: V3;
  fov?: number; // default 40
  roll?: number; // degrees, default 0
  /** frames to stay on this subject, creeping in (no static holds >= 4 f). Default 0 */
  hold?: number;
  /** creep per frame during the hold as a fraction of the distance to the look point. Default 0.0025 (0.25 %/f) */
  push?: number;
  /** 0 = settle on the subject (default). 1 = fly through it at full speed, no stop. */
  pass?: number;
  /** world point to keep in focus here (rack focus between stops) */
  focus?: V3;
};

type Knot = {t: number; p: number[]; m: number[]};

const pack = (c: {pos: V3; look: V3; fov: number; roll: number}) => [...c.pos, ...c.look, c.fov, c.roll];
const unpack = (a: number[]): Cam => ({pos: [a[0], a[1], a[2]], look: [a[3], a[4], a[5]], fov: a[6], roll: a[7]});

/** Camera position after creeping toward the look point for `hold` frames at `push` per frame. */
function creep(s: Stop, hold: number, push: number): V3 {
  const k = Math.exp(-push * hold);
  return [
    s.look[0] + (s.pos[0] - s.look[0]) * k,
    s.look[1] + (s.pos[1] - s.look[1]) * k,
    s.look[2] + (s.pos[2] - s.look[2]) * k,
  ];
}

function buildKnots(stops: Stop[]): Knot[] {
  if (stops.length < 2) throw new Error('flow() needs at least 2 stops');
  const st = [...stops].sort((a, b) => a.f - b.f);
  const raw: {t: number; p: number[]; pass: number; vel?: number[]}[] = [];
  for (const s of st) {
    const base = {pos: s.pos, look: s.look, fov: s.fov ?? 40, roll: s.roll ?? 0};
    const pass = Math.max(0, Math.min(1, s.pass ?? 0));
    const hold = s.hold ?? 0;
    if (hold > 0) {
      const push = s.push ?? 0.0025;
      const a = pack(base);
      const b = pack({...base, pos: creep(s, hold, push)});
      const v = b.map((x, i) => (x - a[i]) / hold); // creep velocity, per frame
      raw.push({t: s.f, p: a, pass: 0, vel: v});
      raw.push({t: s.f + hold, p: b, pass: 0, vel: v});
    } else {
      raw.push({t: s.f, p: pack(base), pass});
    }
  }
  for (let i = 1; i < raw.length; i++) if (raw[i].t <= raw[i - 1].t) throw new Error(`flow(): stop frames must increase (${raw[i - 1].t} then ${raw[i].t})`);
  return raw.map((r, i) => {
    let m: number[];
    if (r.vel) m = r.vel;
    else if (i === 0 || i === raw.length - 1 || r.pass === 0) m = r.p.map(() => 0);
    else {
      const a = raw[i - 1], b = raw[i + 1];
      m = r.p.map((_, d) => (r.pass * (b.p[d] - a.p[d])) / (b.t - a.t));
    }
    return {t: r.t, p: r.p, m};
  });
}

/** Camera function f -> Cam. Before the first stop it holds the first pose; after the last it holds the last. */
export function flow(stops: Stop[]): (f: number) => Cam {
  const knots = buildKnots(stops);
  return (f: number): Cam => {
    if (f <= knots[0].t) return unpack(knots[0].p);
    const last = knots[knots.length - 1];
    if (f >= last.t) return unpack(last.p);
    let i = 0;
    while (i < knots.length - 2 && f >= knots[i + 1].t) i++;
    const a = knots[i], b = knots[i + 1];
    const dt = b.t - a.t;
    const u = (f - a.t) / dt;
    const u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    return unpack(a.p.map((_, d) => h00 * a.p[d] + h10 * dt * a.m[d] + h01 * b.p[d] + h11 * dt * b.m[d]));
  };
}

const smootherstep = (x: number) => {
  const u = Math.max(0, Math.min(1, x));
  return u * u * u * (u * (6 * u - 15) + 10);
};

/** Focus point for `DOF` entries: rack focus from stop to stop, finishing just before each arrival. Needs `focus` on the stops. */
export function flowFocus(stops: Stop[]): (f: number) => V3 {
  const st = [...stops].sort((a, b) => a.f - b.f).filter((s) => s.focus);
  if (st.length === 0) throw new Error('flowFocus(): no stop has a `focus` point');
  return (f: number): V3 => {
    if (f <= st[0].f) return st[0].focus!;
    for (let i = 0; i < st.length - 1; i++) {
      const a = st[i], b = st[i + 1];
      const start = a.f + (a.hold ?? 0); // leave the old subject when the camera leaves
      const end = b.f - 4; // be sharp on the new subject 4 frames before the camera settles
      if (f < start) return a.focus!;
      if (f < b.f) {
        const k = smootherstep((f - start) / Math.max(1, end - start));
        return [0, 1, 2].map((d) => a.focus![d] + (b.focus![d] - a.focus![d]) * k) as V3;
      }
    }
    return st[st.length - 1].focus!;
  };
}

/** Place a camera `dist` metres from `target`, at azimuth `azDeg` (0 = looking along -z) and elevation `elDeg`. */
export function lookFrom(target: V3, dist: number, azDeg: number, elDeg: number, lift = 0): {pos: V3; look: V3} {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  const pos: V3 = [
    target[0] + dist * Math.cos(el) * Math.sin(az),
    target[1] + dist * Math.sin(el) + lift,
    target[2] + dist * Math.cos(el) * Math.cos(az),
  ];
  return {pos, look: target};
}

/** Sanity checks for a flow: returns human-readable warnings (empty = fine). */
export function checkFlow(stops: Stop[], fps = 30): string[] {
  const st = [...stops].sort((a, b) => a.f - b.f);
  const out: string[] = [];
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1];
    const arrive = b.f - (a.f + (a.hold ?? 0));
    if (arrive < 18) out.push(`travel ${i}->${i + 1} takes ${arrive} f; use at least 18 f (0.6 s) or it reads as a jerk`);
    if (arrive > 75) out.push(`travel ${i}->${i + 1} takes ${arrive} f; over 2.5 s feels like a drift, split it with a stop`);
    const dist = Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2]);
    if (dist > 0 && arrive > 0 && dist / arrive > 6) out.push(`travel ${i}->${i + 1} moves ${(dist / arrive).toFixed(1)} m per frame; very fast, check for blur and clipping through walls`);
    if (Math.abs((b.roll ?? 0) - (a.roll ?? 0)) > 8) out.push(`roll changes more than 8 degrees between stops ${i} and ${i + 1}`);
  }
  for (let i = 0; i < st.length; i++) if ((st[i].hold ?? 0) < 4 && i < st.length - 1 && (st[i].pass ?? 0) === 0 && i > 0) out.push(`stop ${i} has no hold; a settle with hold < 4 f feels like a stutter`);
  const total = st[st.length - 1].f - st[0].f;
  if (total / fps > 12) out.push(`one flow lasts ${(total / fps).toFixed(1)} s; cut or dissolve at the next place change`);
  return out;
}
