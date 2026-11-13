// framing_probe.ts — offline check of what the camera actually sees, without rendering a frame.
// Bundled with esbuild and run in node: it imports the SAME story.ts/contract.ts the film uses, so the numbers
// cannot drift from the render. Answers: is each actor inside the frame, how big is it, how soft is it (CoC),
// and is the tram body in front of it. (Written after the first render: the lady turned out to be behind the
// stopped tram for her entire walk, i.e. a fully drawn character nobody ever saw.)
import * as THREE from "three";
import { TRAM, FPS, tramZ } from "../src/videos/tram/contract";
import { camAt, dofAt, SHOTS, boyPos, ladyPos, boatPos } from "../src/videos/tram/story";

const W = 1080, H = 1920;
const cam = new THREE.PerspectiveCamera(35, W / H, 0.2, 700);

function frame(f: number, p: THREE.Vector3) {
  const c = camAt(f);
  cam.position.copy(c.pos); cam.up.set(0, 1, 0); cam.lookAt(c.look);
  cam.rotateZ((c.roll * Math.PI) / 180);
  cam.fov = c.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const ndc = p.clone().project(cam);
  const d = dofAt(f);
  const foc = d.focus ? new THREE.Vector3(...d.focus()) : c.look.clone();
  const fwd = cam.getWorldDirection(new THREE.Vector3());
  const dist = p.clone().sub(cam.position).length();
  const zFocus = Math.max(0.3, foc.clone().sub(cam.position).dot(fwd));
  const coc = Math.min(26, d.cInf * Math.abs(1 - zFocus / Math.max(0.01, p.clone().sub(cam.position).dot(fwd))));
  return { ndc, dist, coc, inFrame: Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z < 1, cam: c };
}

/** Is the tram body between the camera and p? (AABB on the car, generous: full body box.) */
function occludedByTram(f: number, p: THREE.Vector3) {
  const z = tramZ(f);
  const box = new THREE.Box3(new THREE.Vector3(-TRAM.bodySide, 0, z - TRAM.len / 2), new THREE.Vector3(TRAM.bodySide, TRAM.vaultY, z + TRAM.len / 2));
  const ray = new THREE.Ray(cam.position.clone(), p.clone().sub(cam.position).normalize());
  const hit = ray.intersectBox(box, new THREE.Vector3());
  return !!hit && hit.distanceTo(cam.position) < p.distanceTo(cam.position) - 0.05;
}

const who: Array<[string, (f: number) => THREE.Vector3, number]> = [
  ["lady", (f) => ladyPos(f).add(new THREE.Vector3(0, 1.0, 0)), 1.0],
  ["boy ", (f) => boyPos(f).add(new THREE.Vector3(0, 0.95, 0)), 0.95],
  ["boat", (f) => boatPos(f), 0.0],
];

console.log(`frame  shot  actor  inFrame  ndc(x,y)          dist   CoCpx  behindTram`);
for (const f of [0, 30, 53, 100, 150, 180, 205, 230, 248, 290, 324, 330, 340, 348, 352, 358, 364, 370, 376, 388, 405, 430, 449]) {
  const shot = SHOTS.find((s) => f >= s.a && f < s.b)?.id ?? 6;
  for (const [name, at, _h] of who) {
    const p = at(f);
    const r = frame(f, p);
    const occ = occludedByTram(f, p);
    console.log(
      `${String(f).padStart(5)}  ${shot}     ${name}  ${r.inFrame && !occ ? "YES" : "no "}      ` +
        `(${r.ndc.x.toFixed(2)}, ${r.ndc.y.toFixed(2)})`.padEnd(16) +
        ` ${r.dist.toFixed(1).padStart(5)}  ${r.coc.toFixed(1).padStart(5)}  ${occ ? "HIDDEN" : ""}`
    );
  }
}