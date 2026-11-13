// probe3.ts — choose shot 6's camera for the real departure timeline (tram stands until f=405, then pulls away
// over 45 frames; the boy and conductor are already aboard, so only the paper boat is left on the flood).
// Prints, per candidate per frame: where the tram's ends and near-side edge project, where the boat sits, and
// where the lady ends up. The choice is arithmetic, not another 8-minute render.
import * as THREE from "three";
import { TRAM, tramZ, lerp, clamp, smootherstep } from "../src/videos/tram/contract";
import { boatPos, ladyPos } from "../src/videos/tram/story";

const cam = new THREE.PerspectiveCamera(38, 1080 / 1920, 0.2, 700);
type Key = { f: number; pos: [number, number, number]; look: [number, number, number]; fov: number; roll: number };

const CANDS: Record<string, Key[]> = {
  // car-centric: camera 8 m behind the car's rear, nearly on its axis, so the car reads as a rear 3/4 that
  // shrinks into the vanishing point. The boat (3.2 m off the axis) falls just outside the right edge.
  G_car: [
    { f: 405, pos: [3.9, 1.85, 10.5], look: [0.0, 1.2, -3.9], fov: 36.0, roll: -0.6 },
    { f: 450, pos: [3.82, 1.9, 10.75], look: [-0.05, 1.19, -4.2], fov: 35.4, roll: -0.4 },
  ],
  // same stand-off, aimed a touch right so the frame holds car (left) AND the abandoned boat (right).
  G2_both: [
    { f: 405, pos: [3.9, 1.85, 10.5], look: [1.5, 1.2, -3.9], fov: 38.0, roll: -0.6 },
    { f: 450, pos: [3.82, 1.9, 10.75], look: [1.45, 1.18, -4.2], fov: 37.4, roll: -0.4 },
  ],
  // a step further back and wider, for margin on both edges.
  G3_both_wide: [
    { f: 405, pos: [3.8, 1.95, 11.6], look: [1.3, 1.15, -4.0], fov: 40.0, roll: -0.6 },
    { f: 450, pos: [3.72, 2.0, 11.85], look: [1.25, 1.13, -4.3], fov: 39.2, roll: -0.4 },
  ],
  // low at the kerb, 4.6 m from the car line: the car is a flank sweeping out of the left at the cut.
  I_low_kerb: [
    { f: 405, pos: [4.5, 1.35, 4.6], look: [1.0, 1.05, -9.0], fov: 40.0, roll: -0.3 },
    { f: 450, pos: [4.42, 1.4, 4.85], look: [0.95, 1.03, -9.3], fov: 39.4, roll: -0.2 },
  ],
  // near the street's own axis, 13.5 m up-street, aimed straight down: the car's whole rear face (and its tail
  // lamp) is in frame at the cut and shrinks toward the vanishing point, with the boat and lady out to the right.
  J_axis: [
    { f: 405, pos: [1.55, 1.72, 13.5], look: [1.45, 1.12, -9.0], fov: 39.0, roll: -0.2 },
    { f: 450, pos: [1.5, 1.76, 13.75], look: [1.42, 1.11, -9.3], fov: 38.6, roll: -0.1 },
  ],
  J2_axis_wide: [
    { f: 405, pos: [1.55, 1.72, 13.5], look: [1.45, 1.12, -9.0], fov: 43.0, roll: -0.2 },
    { f: 450, pos: [1.5, 1.76, 13.75], look: [1.42, 1.11, -9.3], fov: 42.4, roll: -0.1 },
  ],
  K_axis_back: [
    { f: 405, pos: [1.35, 1.85, 15.0], look: [1.25, 1.15, -9.0], fov: 38.0, roll: -0.2 },
    { f: 450, pos: [1.3, 1.89, 15.25], look: [1.22, 1.14, -9.3], fov: 37.6, roll: -0.1 },
  ],
  L_axis_center: [
    { f: 405, pos: [1.05, 1.86, 15.0], look: [0.95, 1.14, -9.0], fov: 38.0, roll: -0.2 },
    { f: 450, pos: [1.0, 1.9, 15.25], look: [0.92, 1.13, -9.3], fov: 37.6, roll: -0.1 },
  ],
};

function look(ks: Key[], f: number) {
  const t = clamp((f - ks[0].f) / (ks[1].f - ks[0].f), 0, 1), e = smootherstep(0, 1, t);
  const L = (a: number, b: number) => lerp(a, b, e);
  const pos = new THREE.Vector3(L(ks[0].pos[0], ks[1].pos[0]), L(ks[0].pos[1], ks[1].pos[1]), L(ks[0].pos[2], ks[1].pos[2]));
  const at = new THREE.Vector3(L(ks[0].look[0], ks[1].look[0]), L(ks[0].look[1], ks[1].look[1]), L(ks[0].look[2], ks[1].look[2]));
  cam.position.copy(pos); cam.up.set(0, 1, 0); cam.lookAt(at); cam.rotateZ((L(ks[0].roll, ks[1].roll) * Math.PI) / 180);
  cam.fov = L(ks[0].fov, ks[1].fov); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  return cam;
}
const proj = (p: THREE.Vector3) => {
  const n = p.clone().project(cam);
  return { x: n.x, y: n.y, d: p.distanceTo(cam.position), in: Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1 };
};
const f2 = (v: number) => (v >= 0 ? " " : "") + v.toFixed(2);
const tag = (r: { x: number; y: number; in: boolean }) => `${r.in ? "IN " : "out"}(${f2(r.x)},${f2(r.y)})`;

for (const [name, ks] of Object.entries(CANDS)) {
  console.log(`\n== ${name}   fov ${ks[0].fov}`);
  for (const f of [405, 412, 420, 435, 449]) {
    look(ks, f);
    const z = tramZ(f);
    const rearC = proj(new THREE.Vector3(0, 1.3, z + TRAM.len / 2));       // +Z end: the rear on departure
    const noseC = proj(new THREE.Vector3(0, 1.3, z - TRAM.len / 2));       // -Z end: the leading end
    const rearE = proj(new THREE.Vector3(TRAM.bodySide, 1.3, z + TRAM.len / 2)); // near-side top corner of the rear
    const rearF = proj(new THREE.Vector3(-TRAM.bodySide, 1.3, z + TRAM.len / 2)); // far-side top corner of the rear
    const boat = proj(boatPos(f));
    const lady = proj(ladyPos(f).add(new THREE.Vector3(0, 1.0, 0)));
    const widthPct = Math.abs(rearE.x - rearC.x) * 100;
    console.log(
      `  f${f} z=${z.toFixed(1).padStart(6)}  rear ${tag(rearC)} ${rearC.d.toFixed(0)}m  near ${f2(rearE.x)} far ${f2(rearF.x)}` +
        `  nose ${tag(noseC)}  halfW ${widthPct.toFixed(0)}%` +
        `  boat ${tag(boat)} ${boat.d.toFixed(1)}m  lady ${tag(lady)} ${lady.d.toFixed(0)}m`
    );
  }
}
