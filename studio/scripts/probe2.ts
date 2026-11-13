// probe2.ts — try candidate shot-6 cameras against the real actor positions, without rendering.
// Goal: at the f=405 cut, hold the boy (left, watching) and the receding tram (centre) in one frame, with the
// boat bobbing near the lens. Prints ndc x/y per candidate so the choice is arithmetic, not a 12-minute render.
import * as THREE from "three";
import { TRAM, tramZ, lerp, clamp, smootherstep } from "../src/videos/tram/contract";
import { boyPos, ladyPos, boatPos } from "../src/videos/tram/story";

const W = 1080, H = 1920;
const cam = new THREE.PerspectiveCamera(34, W / H, 0.2, 700);

type Key = { f: number; pos: [number, number, number]; look: [number, number, number]; fov: number; roll: number };
const CANDS: Record<string, Key[]> = {
  A_current: [
    { f: 405, pos: [5.3, 2.02, 3.7], look: [0.35, 1.5, -18], fov: 34.0, roll: 0.8 },
    { f: 450, pos: [5.2, 2.08, 3.95], look: [0.25, 1.46, -18.4], fov: 33.6, roll: 0.5 },
  ],
  B_back_left: [
    { f: 405, pos: [4.15, 1.72, 5.6], look: [0.75, 1.2, -16], fov: 34.0, roll: 0.8 },
    { f: 450, pos: [4.05, 1.78, 5.85], look: [0.65, 1.16, -16.4], fov: 33.6, roll: 0.5 },
  ],
  C_low_wide: [
    { f: 405, pos: [4.6, 1.32, 4.9], look: [0.9, 1.5, -17], fov: 38.0, roll: 0.6 },
    { f: 450, pos: [4.5, 1.38, 5.15], look: [0.8, 1.46, -17.4], fov: 37.4, roll: 0.4 },
  ],
};

function at(ks: Key[], f: number, p: THREE.Vector3) {
  const t = clamp((f - ks[0].f) / (ks[1].f - ks[0].f), 0, 1);
  const e = smootherstep(0, 1, t);
  const L = (a: number, b: number) => lerp(a, b, e);
  const pos = new THREE.Vector3(L(ks[0].pos[0], ks[1].pos[0]), L(ks[0].pos[1], ks[1].pos[1]), L(ks[0].pos[2], ks[1].pos[2]));
  const look = new THREE.Vector3(L(ks[0].look[0], ks[1].look[0]), L(ks[0].look[1], ks[1].look[1]), L(ks[0].look[2], ks[1].look[2]));
  cam.position.copy(pos); cam.up.set(0, 1, 0); cam.lookAt(look); cam.rotateZ((L(ks[0].roll, ks[1].roll) * Math.PI) / 180);
  cam.fov = L(ks[0].fov, ks[1].fov); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const ndc = p.clone().project(cam);
  return { x: ndc.x, y: ndc.y, d: p.distanceTo(pos), ok: Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 };
}

const actors: Array<[string, (f: number) => THREE.Vector3]> = [
  ["boy ", (f) => boyPos(f).add(new THREE.Vector3(0, 0.95, 0))],
  ["boat", (f) => boatPos(f).clone()],
  ["lady", (f) => ladyPos(f).add(new THREE.Vector3(0, 1.0, 0))],
  ["tram", (f) => new THREE.Vector3(0, 1.3, tramZ(f))],
];

for (const [name, ks] of Object.entries(CANDS)) {
  console.log(`\n== ${name}  (pos ${ks[0].pos.join(", ")})`);
  for (const f of [405, 420, 435, 449]) {
    const cells = actors.map(([n, at_]) => {
      const p = at_(f), r = at(ks, f, p);
      return `${n} ${r.ok ? "IN " : "out"}(${r.x.toFixed(2)},${r.y.toFixed(2)}) ${r.d.toFixed(0)}m`;
    });
    console.log(`  f${f}: ${cells.join("  |  ")}`);
  }
}
void TRAM; void H; void W;