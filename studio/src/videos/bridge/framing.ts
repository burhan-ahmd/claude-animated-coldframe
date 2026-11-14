// Framing checks for a vertical short: safe area, head size, cut-off foreground blobs.
// Pure three.js maths, no rendering. Run it per shot, on the first, middle and last frame, BEFORE rendering stills:
//
//   import {checkShot} from './framing';
//   const problems = checkShot(camera, [
//     {name: 'hero',   obj: heroGroup,  role: 'must-fit'},   // whole body + props must sit inside the safe area
//     {name: 'heroHead', obj: heroHead, role: 'head'},       // head height <= 30 % of the frame
//     {name: 'pillar', obj: pillar,     role: 'foreground'}, // may be cut by the edge, but not a huge blob
//   ]);
//   if (problems.length) throw new Error(problems.join('\n'));
//
// y is measured from the TOP of the frame (0 = top, 1 = bottom), x from the left.
import * as THREE from 'three';

/** Fractions of the frame that must stay free: platform UI at the bottom, captions, rounded screen corners. */
export const SAFE = {left: 0.06, right: 0.06, top: 0.08, bottom: 0.15};
export const MAX_HEAD_HEIGHT = 0.3; // fraction of frame height (one-shot reaction gags may use 0.4)
export const MAX_FOREGROUND_AREA = 0.35; // fraction of frame area for a cut-off foreground prop

export type Bounds = {minX: number; maxX: number; minY: number; maxY: number; behind: boolean};
export type Role = 'must-fit' | 'head' | 'foreground';
export type Item = {name: string; obj: THREE.Object3D; role: Role; maxHead?: number};

const _box = new THREE.Box3();
const _v = new THREE.Vector3();

/** Screen-space bounds of an object's world bounding box, as fractions of the frame. */
export function screenBounds(obj: THREE.Object3D, camera: THREE.Camera): Bounds | null {
  camera.updateMatrixWorld(true);
  obj.updateWorldMatrix(true, true);
  _box.setFromObject(obj);
  if (_box.isEmpty()) return null;
  const {min, max} = _box;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let behind = false;
  for (let i = 0; i < 8; i++) {
    _v.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z);
    // camera space: points in front of the camera have negative z
    const zc = _v.clone().applyMatrix4(camera.matrixWorldInverse).z;
    if (zc >= -0.01) {
      behind = true;
      continue;
    }
    _v.project(camera);
    const x = (_v.x + 1) / 2;
    const y = (1 - _v.y) / 2;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (!isFinite(minX)) return {minX: 0, maxX: 1, minY: 0, maxY: 1, behind: true};
  return {minX, maxX, minY, maxY, behind};
}

const pct = (n: number) => `${(n * 100).toFixed(1)} %`;

/** Returns a list of human-readable problems for one camera pose. Empty list = the shot passes. */
export function checkShot(camera: THREE.Camera, items: Item[], safe = SAFE): string[] {
  const out: string[] = [];
  for (const it of items) {
    const b = screenBounds(it.obj, camera);
    if (!b) { out.push(`${it.name}: empty or missing object`); continue; }
    const w = b.maxX - b.minX, h = b.maxY - b.minY;
    if (it.role === 'must-fit') {
      if (b.behind) out.push(`${it.name}: part of it is behind the camera`);
      const sides: string[] = [];
      if (b.minX < safe.left) sides.push(`left (${pct(b.minX)} < ${pct(safe.left)})`);
      if (b.maxX > 1 - safe.right) sides.push(`right (${pct(b.maxX)} > ${pct(1 - safe.right)})`);
      if (b.minY < safe.top) sides.push(`top (${pct(b.minY)} < ${pct(safe.top)})`);
      if (b.maxY > 1 - safe.bottom) sides.push(`bottom (${pct(b.maxY)} > ${pct(1 - safe.bottom)})`);
      if (sides.length) out.push(`${it.name}: outside the safe area at ${sides.join(', ')}`);
    } else if (it.role === 'head') {
      const max = it.maxHead ?? MAX_HEAD_HEIGHT;
      if (h > max) out.push(`${it.name}: head is ${pct(h)} of the frame height, max ${pct(max)}`);
      if (b.minX < 0 || b.maxX > 1 || b.minY < 0 || b.maxY > 1) out.push(`${it.name}: head is cut by the frame edge`);
    } else {
      const cut = b.minX < 0 || b.maxX > 1 || b.minY < 0 || b.maxY > 1;
      const vis = Math.max(0, Math.min(1, b.maxX) - Math.max(0, b.minX)) * Math.max(0, Math.min(1, b.maxY) - Math.max(0, b.minY));
      if (b.behind) out.push(`${it.name}: foreground prop is behind or inside the lens`);
      else if (cut && vis > MAX_FOREGROUND_AREA) out.push(`${it.name}: cut-off foreground blob covering ${pct(vis)} of the frame (${pct(w)} x ${pct(h)})`);
    }
  }
  return out;
}
