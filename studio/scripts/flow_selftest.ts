// Self-test for studio/src/videos/bridge/flow.ts. Run from the repo root:  npx tsx studio/scripts/flow_selftest.ts
// Pure camera-path maths, no rendering, no node_modules needed. Runs in the CI craft gate.
import { flow, flowFocus, lookFrom, checkFlow, Stop } from "../src/videos/bridge/flow";

let failed = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);
};

const TOWER = lookFrom([0, 150, 0], 160, 20, 8);
const CROWD = lookFrom([6, 1.4, 12], 5, -25, 4);
const HERO = lookFrom([8, 1.5, 12.5], 2.2, -10, 2);
const stops: Stop[] = [
  { f: 0, ...TOWER, hold: 20, focus: [0, 150, 0] },
  { f: 58, ...CROWD, hold: 24, focus: [6, 1.2, 12] },
  { f: 118, ...HERO, hold: 30, focus: [8, 1.6, 12.5] },
];
const cam = flow(stops);

// 1. arrives exactly on each subject
const near = (a: number[], b: number[], tol = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < tol);
ok("arrives at the crowd on its frame", near(cam(58).pos, CROWD.pos) && near(cam(58).look, CROWD.look));
ok("arrives at the face on its frame", near(cam(118).pos, HERO.pos) && near(cam(118).look, HERO.look));

// 2. no jumps: the largest per-frame position step is not a cut (compare to the average travel step)
const steps: number[] = [];
for (let f = 0; f < 148; f++) {
  const a = cam(f).pos, b = cam(f + 1).pos;
  steps.push(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
}
const maxStep = Math.max(...steps);
const total = steps.reduce((s, x) => s + x, 0);
ok(
  "one continuous path (no single frame holds a big share of the travel)",
  maxStep < 0.12 * total,
  `max step ${maxStep.toFixed(2)} m, total ${total.toFixed(1)} m`,
);

// 3. velocity is continuous (no sudden speed change between consecutive frames)
let worst = 0;
for (let f = 1; f < steps.length; f++) worst = Math.max(worst, Math.abs(steps[f] - steps[f - 1]) / Math.max(1e-6, maxStep));
ok("speed changes smoothly frame to frame", worst < 0.15, `worst jump ${(worst * 100).toFixed(1)} % of peak speed`);

// 4. holds creep in at about the requested rate (default 0.25 %/f) and are never static
const d0 = Math.hypot(...([0, 1, 2].map((d) => cam(60).pos[d] - cam(60).look[d]) as [number, number, number]));
const d1 = Math.hypot(...([0, 1, 2].map((d) => cam(76).pos[d] - cam(76).look[d]) as [number, number, number]));
const rate = (1 - d1 / d0) / 16;
ok("hold pushes in slowly (0.15-0.35 %/f)", rate > 0.0015 && rate < 0.0035, `${(rate * 100).toFixed(3)} %/f`);

// 5. rack focus lands on the new subject before the camera settles
const ff = flowFocus(stops);
ok("focus is on the crowd 4 frames before arrival", near(ff(54), [6, 1.2, 12]));
ok("focus is still on the tower while holding on it", near(ff(10), [0, 150, 0]));

// 6. checkFlow
ok("good plan has no warnings", checkFlow(stops).length === 0, checkFlow(stops).join(" | "));
ok("too-fast travel is flagged", checkFlow([{ f: 0, ...TOWER, hold: 10 }, { f: 22, ...HERO, hold: 10 }]).length > 0);

if (failed) throw new Error(`${failed} flow test(s) failed`);
console.log("all flow tests passed");
