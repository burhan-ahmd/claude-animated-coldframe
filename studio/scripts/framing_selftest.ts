// Self-test for studio/src/videos/bridge/framing.ts. Run from the repo root:  npx tsx studio/scripts/framing_selftest.ts
// Pure three.js maths, no rendering. Needs `three` installed in the project. Runs in the CI craft gate.
import * as THREE from "three";
import { checkShot } from "../src/videos/bridge/framing";

const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.1, 500);
cam.position.set(0, 1.5, 8);
cam.lookAt(0, 1.5, 0);
cam.updateMatrixWorld(true);

const box = (x: number, y: number, z: number, w: number, h: number) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3));
  m.position.set(x, y, z);
  m.updateMatrixWorld(true);
  return m;
};

let failed = 0;
const expect = (label: string, got: string[], wantProblem: boolean) => {
  const ok = wantProblem ? got.length > 0 : got.length === 0;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${got.length ? "  -> " + got.join(" | ") : ""}`);
};

expect("character fully inside the safe area", checkShot(cam, [{ name: "hero", obj: box(0, 1.5, 0, 1, 2.2), role: "must-fit" }]), false);
expect("character cut off at the bottom", checkShot(cam, [{ name: "hero", obj: box(0, -0.4, 0, 1, 2.2), role: "must-fit" }]), true);
expect("prop pushed off the right edge", checkShot(cam, [{ name: "folder", obj: box(2.0, 1.5, 0, 1.2, 0.8), role: "must-fit" }]), true);
expect("small head", checkShot(cam, [{ name: "head", obj: box(0, 1.5, 0, 0.6, 0.6), role: "head" }]), false);
expect("giant head close to the lens", checkShot(cam, [{ name: "head", obj: box(0, 1.5, 5.5, 1.0, 1.0), role: "head" }]), true);
expect("huge cut-off foreground prop", checkShot(cam, [{ name: "bush", obj: box(1.0, 1.0, 6.5, 3, 3), role: "foreground" }]), true);
expect("small foreground prop at the edge", checkShot(cam, [{ name: "pillar", obj: box(1.3, 1.5, 3, 0.4, 3), role: "foreground" }]), false);
expect("object behind the camera", checkShot(cam, [{ name: "ghost", obj: box(0, 1.5, 12, 1, 1), role: "must-fit" }]), true);

if (failed) throw new Error(`${failed} framing test(s) failed`);
console.log("all framing tests passed");
