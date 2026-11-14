// Static scenery for "Pip and the Noon Bell": ONE continuous hillside-town street along z (travel -z) that all
// eight shots live on. Merged batches (one mesh per material) carry the ground, quays, the stone arch bridge, the
// bakery block, the market stalls, the jettied lane, the retaining walls + terraces of the climb, and the church
// terrace (cobbled square, lychgate, gravestones, big church, detached campanile with an open belfry, the bell and
// the clock). The only animated pieces (built here, driven by world.ts) are the bell, its rope and the clock face.
// CC0 Kenney props (trees, lanterns, hedges, cart, canoe, windmill) are dressed with prop()/kitClone().
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  streetY, STREET_HALF, Z_BAKERY, Z_MARKET, Z_LANE, RIVER_Z1, RIVER_Z0, Z_RIVER, WATER_Y,
  RAMP0, RAMP1, RAMP_H, Z_SQUARE, Z_TOWER, Z_DOOR, Z_END, overWater,
} from "./contract";
import {
  brick, rng, ctex, rep, facadeHD, roofHD, stoneHD, terraceHD, crateHD, barrelHD, sackHD, breadHD, beam, bed,
  awningHD, valanceHD, stallHD, stallValance, ivyTex, bakeryShopHD, churchHD, signHD, clockHD,
  cobbleHD, grassHD, planksHD,
} from "./paint";
import { twoTone } from "./shade";

export type Kit = Record<string, THREE.Object3D>;
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------- materials (shared, cached) ----------------
const mats = new Map<string, THREE.Material>();
export const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters) => {
  let m = mats.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) { m = twoTone(new THREE.MeshLambertMaterial(make())); mats.set(key, m); }
  return m;
};
const lamOf = new Map<string, THREE.MeshLambertMaterial>();
const GREENS = ["#62ae4c", "#56a447", "#72b853"];
const RECOLOR: Record<string, string> = { grass: "#6aab4f", leafsDark: "#4a9142", woodBark: "#8a5a3c", woodInner: "#e8cfa4",
  wood: "#a8724a", woodDark: "#7a4f33", dirt: "#8a6a4a", stone: "#b7b4ad" };
/** Kenney GLB materials -> Lambert, so the whole world shares one lighting model */
const toLambert = (m: THREE.Material) => {
  let l = lamOf.get(m.uuid);
  if (!l) {
    const s = m as THREE.MeshStandardMaterial;
    const col = m.name === "leafsGreen" ? GREENS[lamOf.size % 3] : RECOLOR[m.name];
    l = twoTone(new THREE.MeshLambertMaterial({ color: col ? new THREE.Color(col) : s.color?.clone() ?? new THREE.Color("#ffffff"),
      map: s.map ?? null, side: s.side, alphaTest: s.alphaTest }));
    lamOf.set(m.uuid, l);
  }
  return l;
};

// ---------------- geometry pieces ----------------
const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new THREE.Float32BufferAttribute(out, a.itemSize);
};
/** quad a,b,c,d counter-clockwise seen from its front; uv (u0,v0) at a, (u1,v1) at c */
export const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u1 = 1, v1 = 1, u0 = 0, v0 = 0) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c, a, c, d].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2, 3, 4, 5].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
  return g;
};
/** quad with its winding forced so the face normal points along `n` (avoids reasoning about UV sign per call) */
export const quadN = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, n: THREE.Vector3, u1 = 1, v1 = 1) => {
  const g = quad(a, b, c, d, u1, v1);
  const gn = g.attributes.normal as THREE.BufferAttribute;
  return gn.getX(0) * n.x + gn.getY(0) * n.y + gn.getZ(0) * n.z < 0 ? quad(a, d, c, b, u1, v1) : g;
};
export const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
  return g;
};
/** axis box from min to max, texture tiled every `tile` metres (0 = one image per face) */
export const boxGeo = (min: THREE.Vector3, max: THREE.Vector3, tile = 0, bottom = false) => {
  const [x0, y0, z0] = [min.x, min.y, min.z], [x1, y1, z1] = [max.x, max.y, max.z];
  const t = (a: number) => (tile ? a / tile : 1);
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const faces = [
    quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), t(w), t(h)),
    quad(V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), t(w), t(h)),
    quad(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), t(d), t(h)),
    quad(V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), t(d), t(h)),
    quad(V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(x0, y1, z0), t(w), t(d)),
  ];
  if (bottom) faces.push(quad(V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), t(w), t(d)));
  return mergeGeometries(faces, false);
};
/** horizontal ground strip x0..x1 along z, y = yf(z); `zA > zB` (travel -z) so the face points up. uv = m * k */
export const strip = (x0: number, x1: number, zA: number, zB: number, yf: (z: number) => number, k = 0.25, step = 2) => {
  const gs: THREE.BufferGeometry[] = [];
  const n = Math.max(1, Math.round(Math.abs(zB - zA) / step)), kx = (x1 - x0) * k;
  for (let i = 0; i < n; i++) {
    const za = zA + ((zB - zA) * i) / n, zb = zA + ((zB - zA) * (i + 1)) / n;
    gs.push(quad(V(x0, yf(za), za), V(x1, yf(za), za), V(x1, yf(zb), zb), V(x0, yf(zb), zb), kx, Math.abs(zb - za) * k));
  }
  return mergeGeometries(gs, false);
};
/** vertical wall at z spanning x0..x1 between y0..y1, facing +z (dir 1) or -z (dir -1); uv = m * k */
export const wallZ = (x0: number, x1: number, z: number, y0: number, y1: number, dir: number, k = 0.25) => {
  const g = new THREE.BufferGeometry();
  const pos = dir > 0 ? [x0, y0, z, x1, y0, z, x1, y1, z, x0, y0, z, x1, y1, z, x0, y1, z]
    : [x1, y0, z, x0, y0, z, x0, y1, z, x1, y0, z, x0, y1, z, x1, y1, z];
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(6).fill([0, 0, dir]).flat(), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, (x1 - x0) * k, 0, (x1 - x0) * k, (y1 - y0) * k, 0, 0, (x1 - x0) * k, (y1 - y0) * k, 0, (y1 - y0) * k], 2));
  return g;
};
/** vertical wall at x spanning z0..z1 between y0..y1, facing +x (dir 1) or -x (dir -1); uv = m * k */
export const wallX = (x: number, z0: number, z1: number, y0: number, y1: number, dir: number, k = 0.25) => {
  const g = new THREE.BufferGeometry();
  const pos = dir > 0 ? [x, y0, z1, x, y0, z0, x, y1, z0, x, y0, z1, x, y1, z0, x, y1, z1]
    : [x, y0, z0, x, y0, z1, x, y1, z1, x, y0, z0, x, y1, z1, x, y1, z0];
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(6).fill([dir, 0, 0]).flat(), 3));
  const u = Math.abs(z1 - z0) * k, v = (y1 - y0) * k;
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
};

/** collects pieces by material and merges them into one static mesh per material */
export class Batch {
  private g = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4) {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const x = new THREE.BufferGeometry();
    x.setAttribute("position", f32(src.attributes.position));
    if (src.attributes.normal) x.setAttribute("normal", f32(src.attributes.normal)); else x.computeVertexNormals();
    x.setAttribute("uv", src.attributes.uv ? f32(src.attributes.uv) : new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
    if (m) x.applyMatrix4(m);
    const l = this.g.get(mat);
    if (l) l.push(x); else this.g.set(mat, [x]);
  }
  addObject(o: THREE.Object3D, m: THREE.Matrix4) {
    o.updateMatrixWorld(true);
    o.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!mesh.isMesh) return;
      this.add(mesh.geometry, toLambert(Array.isArray(mesh.material) ? mesh.material[0] : mesh.material), new THREE.Matrix4().multiplyMatrices(m, mesh.matrixWorld));
    });
  }
  build(parent: THREE.Object3D, cast = true) {
    for (const [mat, list] of this.g) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
      mesh.castShadow = cast; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.g.clear();
  }
}

// ---------------- strands: box-section tube along a path, rebuilt in place ----------------
export class Strand {
  mesh: THREE.Mesh;
  private pos: Float32Array; private nor: Float32Array; private uv: Float32Array;
  constructor(public n: number, public w: number, public h: number, mat: THREE.Material, public tile = 1, cast = true) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 12); this.nor = new Float32Array(n * 12); this.uv = new Float32Array(n * 8);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(this.nor, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(this.uv, 2));
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < 4; k++) {
      const a = i * 4 + k, b = i * 4 + ((k + 1) % 4), c = (i + 1) * 4 + ((k + 1) % 4), d = (i + 1) * 4 + k;
      idx.push(a, b, c, a, c, d);
    }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false; this.mesh.castShadow = cast; this.mesh.receiveShadow = true;
  }
  private T = new THREE.Vector3(); private S = new THREE.Vector3(); private N = new THREE.Vector3();
  set(pts: THREE.Vector3[]) {
    const { T, S, N } = this;
    let len = 0;
    for (let i = 0; i < this.n; i++) {
      const p = pts[Math.min(i, pts.length - 1)];
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      T.subVectors(b, a).normalize();
      S.crossVectors(T, V(0, 1, 0));
      if (S.lengthSq() < 1e-6) S.set(1, 0, 0);
      S.normalize(); N.crossVectors(S, T).normalize();
      if (i) len += p.distanceTo(pts[Math.min(i - 1, pts.length - 1)]);
      for (let k = 0; k < 4; k++) {
        const sx = k === 0 || k === 3 ? -1 : 1, sy = k < 2 ? -1 : 1, j = (i * 4 + k) * 3;
        this.pos[j] = p.x + S.x * sx * this.w / 2 + N.x * sy * this.h / 2;
        this.pos[j + 1] = p.y + S.y * sx * this.w / 2 + N.y * sy * this.h / 2;
        this.pos[j + 2] = p.z + S.z * sx * this.w / 2 + N.z * sy * this.h / 2;
        const nx = S.x * sx + N.x * sy, ny = S.y * sx + N.y * sy, nz = S.z * sx + N.z * sy, nl = Math.hypot(nx, ny, nz);
        this.nor[j] = nx / nl; this.nor[j + 1] = ny / nl; this.nor[j + 2] = nz / nl;
        this.uv[(i * 4 + k) * 2] = k / 4; this.uv[(i * 4 + k) * 2 + 1] = len / this.tile;
      }
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; g.attributes.uv.needsUpdate = true;
  }
}

// ---------------- sight lines of the film (optional decoration only) ----------------
export type Ray = { o: THREE.Vector3; d: THREE.Vector3; len: number; core: boolean };
let sight: Ray[] = [];
/** does any sight line pass through this box? (the STREET-lining set is built with sight = [] so it is never culled) */
export const inTheWay = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, coreOnly = false) => {
  for (const { o, d, len, core } of sight) {
    if (coreOnly && !core) continue;
    let t0 = 0, t1 = len;
    for (const [oo, dd, a, b] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
      if (Math.abs(dd) < 1e-9) { if (oo < a || oo > b) t0 = Infinity; continue; }
      const ta = (a - oo) / dd, tb = (b - oo) / dd;
      t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
    }
    if (t0 <= t1) return true;
  }
  return false;
};

// ---------------- cartoon vegetation (smooth blobs; the two-tone sun term does the modelling) ----------------
type VegKind = "round" | "fat" | "tall" | "cone" | "bush" | "hedge";
const VEG: Record<string, VegKind> = {
  tree_oak: "round", tree_default: "round", tree_detailed: "round", tree_fat: "fat", "tree-high-round": "tall", tree: "tall",
  tree_cone: "cone", plant_bushLarge: "bush", plant_bushDetailed: "bush", plant_bush: "bush", hedge: "hedge",
};
const LEAF = ["#5aa83c", "#4c9a37", "#69b545", "#55a243", "#3f8f3c"];
const leafTex = (i: number) => ctex("leafHD" + i, 256, 128, (g, r) => {
  const base = new THREE.Color(LEAF[i]), top = base.clone().offsetHSL(0.012, 0.03, 0.08), bot = base.clone().offsetHSL(-0.015, 0.0, -0.08);
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, "#" + top.getHexString()); gr.addColorStop(0.42, "#" + base.getHexString()); gr.addColorStop(1, "#" + bot.getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  for (let k = 0; k < 46; k++) {
    const x = r() * 256, y = 10 + r() * 108, rad = 5 + r() * 9, light = y < 64 ? r() < 0.7 : r() < 0.25;
    for (const ox of [-256, 0, 256]) {
      g.strokeStyle = light ? "rgba(225,255,170,0.22)" : "rgba(20,70,30,0.2)"; g.lineWidth = 2.5; g.lineCap = "round";
      g.beginPath(); g.arc(x + ox, y + rad * 0.6, rad, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
  }
});
const leafMat = (i: number) => lam("leafHD" + i, () => ({ map: leafTex(i) }));
const barkMat = () => lam("barkHD", () => ({ color: "#8f5d3b" }));
const vegGeo = new Map<string, THREE.BufferGeometry>();
const lobeGeo = (q: number) => {
  const k = "lobe" + q;
  let g = vegGeo.get(k);
  if (!g) { g = new THREE.SphereGeometry(1, [20, 14, 10][q], [14, 10, 7][q]); vegGeo.set(k, g); }
  return g;
};
const trunkGeo = () => {
  let g = vegGeo.get("trunk");
  if (!g) { g = new THREE.CylinderGeometry(0.6, 1, 1, 10, 1, true).translate(0, 0.5, 0); vegGeo.set("trunk", g); }
  return g;
};
const hedgeGeo = () => {
  let g = vegGeo.get("hedge");
  if (!g) {
    g = new THREE.BoxGeometry(1, 1, 1, 18, 10, 10);
    const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute;
    const R = [0.106, 0.29, 0.385], v = new THREE.Vector3(), e = new THREE.Vector3(), q = [0, 0, 0];
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      for (let a = 0; a < 3; a++) { const c = v.getComponent(a), lim = a === 1 && c < 0 ? 0.5 : 0.5 - R[a]; q[a] = THREE.MathUtils.clamp(c, -lim, lim); e.setComponent(a, (c - q[a]) / R[a]); }
      const L = e.length();
      if (L < 1e-6) continue;
      e.divideScalar(L);
      p.setXYZ(i, q[0] + e.x * R[0], q[1] + e.y * R[1], q[2] + e.z * R[2]);
      const nn = new THREE.Vector3(e.x / R[0], e.y / R[1], e.z / R[2]).normalize();
      n.setXYZ(i, nn.x, nn.y, nn.z);
    }
    g.translate(0, 0.5, 0);
    vegGeo.set("hedge", g);
  }
  return g;
};
const yawQ = (a: number) => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a);
const vegRad = (k: VegKind, h: number) => (k === "hedge" ? 1.7 : k === "bush" ? 0.85 * h : k === "tall" ? 0.2 * h : k === "cone" ? 0.27 * h : k === "fat" ? 0.44 * h : 0.39 * h);
/** add one cartoon plant to a batch: base at (x, y, z), height h, q = lobe detail (0 near .. 2 far) */
const addVeg = (b: Batch, k: VegKind, x: number, y: number, z: number, h: number, seed: number, q = 0) => {
  const r = rng(Math.abs(Math.floor(seed)) % 200000 + 7), U = (a: number, c: number) => a + (c - a) * r();
  const leaf = leafMat(k === "cone" ? 4 : k === "hedge" ? 1 : Math.floor(r() * 4)), lobe = lobeGeo(q), yaw = r() * 6.28;
  const put = (px: number, py: number, pz: number, rad: number, sy = 0.9) =>
    b.add(lobe, leaf, new THREE.Matrix4().compose(V(x + px, y + py, z + pz), yawQ(r() * 6.28), V(rad, rad * sy, rad)));
  const trunk = (th: number, tr: number) =>
    b.add(trunkGeo(), barkMat(), new THREE.Matrix4().compose(V(x, y - 0.15, z), yawQ(yaw), V(tr, th + 0.15, tr)));
  const ring = (n: number, dist: number, r0: number, r1: number, cy: number, dy: number) => {
    const a0 = r() * 6.28;
    for (let i = 0; i < n; i++) { const a = a0 + (i * 6.28) / n + U(-0.35, 0.35), dd = dist * U(0.85, 1.12); put(Math.cos(a) * dd, cy + U(-dy, dy), Math.sin(a) * dd, U(r0, r1)); }
  };
  if (k === "round" || k === "fat") {
    const f = k === "fat";
    trunk((f ? 0.4 : 0.48) * h, 0.055 * h);
    const cy = (f ? 0.58 : 0.64) * h;
    put(0, cy, 0, (f ? 0.29 : 0.26) * h);
    ring(f ? 5 : 4, (f ? 0.22 : 0.18) * h, (f ? 0.19 : 0.17) * h, (f ? 0.23 : 0.21) * h, cy - 0.05 * h, 0.04 * h);
    put(U(-0.05, 0.05) * h, cy + (f ? 0.15 : 0.17) * h, U(-0.05, 0.05) * h, (f ? 0.19 : 0.17) * h);
  } else if (k === "tall") {
    trunk(0.34 * h, 0.045 * h);
    put(0, 0.47 * h, 0, 0.17 * h, 1.3); put(U(-0.03, 0.03) * h, 0.65 * h, U(-0.03, 0.03) * h, 0.15 * h, 1.3); put(0, 0.82 * h, 0, 0.11 * h, 1.25);
    ring(3, 0.1 * h, 0.1 * h, 0.12 * h, 0.55 * h, 0.06 * h);
  } else if (k === "cone") {
    trunk(0.2 * h, 0.05 * h);
    put(0, 0.3 * h, 0, 0.26 * h, 0.62); put(0, 0.5 * h, 0, 0.2 * h, 0.66); put(0, 0.68 * h, 0, 0.14 * h, 0.75); put(0, 0.84 * h, 0, 0.08 * h, 1.0);
  } else if (k === "bush") {
    put(0, 0.46 * h, 0, 0.5 * h); ring(3, 0.42 * h, 0.32 * h, 0.38 * h, 0.32 * h, 0.04 * h);
  } else {
    b.add(hedgeGeo(), leaf, new THREE.Matrix4().compose(V(x, y - 0.06, z), new THREE.Quaternion(), V(3.3, h + 0.06, Math.max(0.9, h * 0.78))));
  }
};

// ---------------- Kenney props ----------------
const boxes = new Map<THREE.Object3D, THREE.Box3>();
/** place a Kenney model with its base on y, scaled to height h (left out when it would stand in front of the lens). */
export const prop = (b: Batch, kit: Kit, name: string, x: number, y: number, z: number, h: number, yaw = 0) => {
  const vk = VEG[name];
  if (vk) {
    const rad = vegRad(vk, h);
    if (inTheWay(x - rad, x + rad, y, y + h, z - rad, z + rad, true)) return;
    const d = Math.hypot(x, z);
    addVeg(b, vk, x, y, z, h, x * 92.7 + z * 31.3 + yaw * 1000, d > 200 ? 2 : Math.abs(z) > 45 && d > 60 ? 1 : 0);
    return;
  }
  const o = kit[name];
  if (!o) return;
  let box = boxes.get(o);
  if (!box) { box = new THREE.Box3().setFromObject(o); boxes.set(o, box); }
  const s = h / Math.max(0.01, box.max.y - box.min.y), r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * s * 0.5;
  if (inTheWay(x - r, x + r, y, y + h, z - r, z + r, true)) return;
  b.addObject(o, new THREE.Matrix4().compose(V(x, y - box.min.y * s, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(s, s, s)));
};
/** a Kenney model as its own object (two-tone materials), base at y = 0, scaled to height h; no sight-line test */
export const kitClone = (kit: Kit, name: string, h: number): THREE.Object3D | null => {
  const vk = VEG[name];
  if (vk) {
    const vb = new Batch(), grp = new THREE.Group();
    addVeg(vb, vk, 0, 0, 0, h, name.length * 977 + h * 131, 0);
    vb.build(grp, false);
    grp.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = true; } });
    return grp;
  }
  const o = kit[name];
  if (!o) return null;
  let box = boxes.get(o);
  if (!box) { box = new THREE.Box3().setFromObject(o); boxes.set(o, box); }
  const c = o.clone(true), s = h / Math.max(0.01, box.max.y - box.min.y);
  c.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh) { m.material = toLambert(Array.isArray(m.material) ? m.material[0] : m.material); m.castShadow = false; m.receiveShadow = true; } });
  const g = new THREE.Group();
  c.position.y = -box.min.y * s; c.scale.setScalar(s);
  g.add(c);
  return g;
};
// ---------------- houses ----------------
/** style by index: JS % keeps the sign (si = Math.floor(z) is negative on the whole -z street), so wrap explicitly
 *  — a negative index would return undefined and crash the texture painter on "reading 'wall'" (run 43549736126) */
const stOf = <T,>(a: T[], i: number): T => a[((i % a.length) + a.length) % a.length];
type Style = { wall: string; shutter: string; roof: string; timber?: boolean; brick?: boolean };
// warm ochre / cream / sandstone / salmon walls (a near-neutral albedo turns lilac under the two-tone shade)
const STYLES: Style[] = [
  { wall: "#ecdab2", shutter: "#3f6fb5", roof: "#d27a62" },
  { wall: "#d8a95f", shutter: "#2f6a43", roof: "#b8644f" },
  { wall: "#c47a5c", shutter: "#2f5f6a", roof: "#8f97a8" },
  { wall: "#efdcb8", shutter: "#2f5f6a", roof: "#c9775a", timber: true },
  { wall: "#ddbd78", shutter: "#5a3b2a", roof: "#d27a62" },
  { wall: "#cc9a6c", shutter: "#3f6fb5", roof: "#8e7aa0" },
  { wall: "#e2c49a", shutter: "#8c3b4a", roof: "#c9775a" },
  { wall: "#e3d2b8", shutter: "#2f6a43", roof: "#8f97a8", brick: true },
];
const STYLES_T: Style[] = [ // terrace rows up the climb: paler, tighter, shared roofline
  { wall: "#efdfc0", shutter: "#3f6fb5", roof: "#c9775a" },
  { wall: "#e8cf9c", shutter: "#2f6a43", roof: "#b8644f" },
  { wall: "#ecd9bd", shutter: "#8c3b4a", roof: "#8f97a8" },
  { wall: "#e3cfa2", shutter: "#5a3b2a", roof: "#cc8060" },
];
const roofMat = (col: string) => lam("roof" + col, () => ({ map: roofHD(col, col === "#8f97a8"), side: THREE.DoubleSide }));
const UB = new THREE.BoxGeometry(1, 1, 1);
const trimM = () => lam("trimStone", () => ({ color: "#efe3c8" }));
const capM = () => lam("chimCap", () => ({ color: "#9a8778" }));
const plinthM = () => lam("plinthHD", () => ({ map: stoneHD("copeHD") }));
const ub = (b: Batch, mat: THREE.Material, m: THREE.Matrix4, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
  b.add(UB, mat, m.clone().multiply(new THREE.Matrix4().compose(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), new THREE.Quaternion(), V(x1 - x0, y1 - y0, z1 - z0))));
/** gabled house: front facade (local +z) at width w, depth d, wall height h, ridge along local x; base at y */
export const house = (b: Batch, x: number, z: number, yaw: number, w: number, d: number, h: number, si: number, y = 0, styles: Style[] = STYLES) => {
  const across = Math.abs(Math.sin(yaw)) > 0.5, hx = (across ? d : w) / 2 + 0.6, hz = (across ? w : d) / 2 + 0.6;
  if (inTheWay(x - hx, x + hx, y, y + h + d * 0.42 + 1.2, z - hz, z + hz)) return;
  const st = stOf(styles, si);
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
  const front = lam(`hf${si}_${w}_${h}_${st.wall}`, () => ({ map: facadeHD(`hf${si}_${w}_${h}_${st.wall}`, w, h, { ...st, door: true }) }));
  const side = lam(`hs${si}_${h}_${st.wall}`, () => ({ map: facadeHD(`hs${si}_${h}_${st.wall}`, 8, h, st) }));
  const wall = lam("wall" + st.wall, () => ({ color: st.brick ? "#c8643f" : st.wall }));
  const hw = w / 2, hd = d / 2, rh = d * 0.42, o = 0.35;
  b.add(quad(V(-hw, 0, hd), V(hw, 0, hd), V(hw, h, hd), V(-hw, h, hd)), front, m);
  b.add(quad(V(hw, 0, -hd), V(-hw, 0, -hd), V(-hw, h, -hd), V(hw, h, -hd)), side, m);
  b.add(quad(V(-hw, 0, -hd), V(-hw, 0, hd), V(-hw, h, hd), V(-hw, h, -hd)), side, m);
  b.add(quad(V(hw, 0, hd), V(hw, 0, -hd), V(hw, h, -hd), V(hw, h, hd)), side, m);
  b.add(tri(V(-hw, h, -hd), V(-hw, h, hd), V(-hw, h + rh, 0)), wall, m);
  b.add(tri(V(hw, h, hd), V(hw, h, -hd), V(hw, h + rh, 0)), wall, m);
  const ru = (w + 2 * o) / 4, rv = Math.hypot(hd + o, rh) / 4, rm = roofMat(st.roof);
  b.add(quad(V(-hw - o, h - 0.25, hd + o), V(hw + o, h - 0.25, hd + o), V(hw + o, h + rh, 0), V(-hw - o, h + rh, 0), ru, rv), rm, m);
  b.add(quad(V(hw + o, h - 0.25, -hd - o), V(-hw - o, h - 0.25, -hd - o), V(-hw - o, h + rh, 0), V(hw + o, h + rh, 0), ru, rv), rm, m);
  const cx = hw * 0.45 * (si % 2 ? 1 : -1);
  b.add(boxGeo(V(cx - 0.4, h + rh * 0.3, -hd * 0.35 - 0.4), V(cx + 0.4, h + rh + 1.1, -hd * 0.35 + 0.4), 2), lam("chim", () => ({ map: rep(brick(), 1, 1) })), m);
  houseDetail(b, m, w, d, h, rh, cx);
};
/** stone plinth, cornices, window sills + hoods matching facadeHD's layout, door step + hood, chimney cap and pot */
const houseDetail = (b: Batch, m: THREE.Matrix4, w: number, d: number, h: number, rh: number, chx: number) => {
  const hw = w / 2, hd = d / 2, tm = trimM(), floors = Math.max(1, Math.floor(h / 2.8));
  b.add(boxGeo(V(-hw - 0.07, -0.05, -hd - 0.07), V(hw + 0.07, 0.45, hd + 0.07), 2), plinthM(), m);
  ub(b, tm, m, -hw - 0.12, hw + 0.12, h - 0.52, h - 0.25, hd, hd + 0.17);
  ub(b, tm, m, -hw - 0.12, hw + 0.12, h - 0.52, h - 0.25, -hd - 0.17, -hd);
  for (const s of [-1, 1]) ub(b, tm, m, s < 0 ? -hw - 0.17 : hw, s < 0 ? -hw : hw + 0.17, h - 0.52, h - 0.25, -hd - 0.12, hd + 0.12);
  const wins = (len: number, door: boolean, at: (u: number) => [number, number], out: [number, number]) => {
    const n = Math.max(1, Math.floor(len / 2.2));
    for (let fl = 0; fl < floors; fl++) for (let i = 0; i < n; i++) {
      const [px, pz] = at((i + 0.5) / n), yb = fl * 2.8 + 0.9;
      if (door && fl === 0 && i === Math.floor(n / 2)) {
        const along = (k: number) => [px + out[1] * k, pz - out[0] * k] as const;
        const [ax, az] = along(-0.82), [bx, bz] = along(0.82), [cx2, cz2] = along(-0.78), [dx2, dz2] = along(0.78);
        ub(b, plinthM(), m, Math.min(ax, bx, ax + out[0] * 0.5), Math.max(ax, bx, ax + out[0] * 0.5), 0, 0.2, Math.min(az, bz, az + out[1] * 0.5), Math.max(az, bz, az + out[1] * 0.5));
        ub(b, tm, m, Math.min(cx2, dx2, cx2 + out[0] * 0.34), Math.max(cx2, dx2, cx2 + out[0] * 0.34), 2.3, 2.44, Math.min(cz2, dz2, cz2 + out[1] * 0.34), Math.max(cz2, dz2, cz2 + out[1] * 0.34));
        continue;
      }
      for (const [y0, y1, dep, half] of [[yb - 0.2, yb - 0.08, 0.14, 0.6], [yb + 1.33, yb + 1.43, 0.08, 0.55]] as const) {
        const ax = px - out[1] * half, az = pz + out[0] * half, bx = px + out[1] * half, bz = pz - out[0] * half;
        ub(b, tm, m, Math.min(ax, bx, ax + out[0] * dep), Math.max(ax, bx, ax + out[0] * dep), y0, y1, Math.min(az, bz, az + out[1] * dep), Math.max(az, bz, az + out[1] * dep));
      }
    }
  };
  wins(w, true, (u) => [-hw + u * w, hd], [0, 1]);
  wins(8, false, (u) => [hw - u * w, -hd], [0, -1]);
  wins(8, false, (u) => [-hw, -hd + u * d], [-1, 0]);
  wins(8, false, (u) => [hw, hd - u * d], [1, 0]);
  const cz = -hd * 0.35, top = h + rh + 1.1;
  ub(b, capM(), m, chx - 0.52, chx + 0.52, top, top + 0.16, cz - 0.52, cz + 0.52);
  b.add(new THREE.CylinderGeometry(0.13, 0.16, 0.42, 10).translate(0, 0.21, 0), lam("chimPot", () => ({ color: "#b8684a" })), m.clone().multiply(new THREE.Matrix4().makeTranslation(chx, top + 0.16, cz)));
};

// ---------------- painted extras ----------------
/** the town flag (market + church): ochre bands with a blue diamond (the bakery's hanging-sign motif) */
export const flagTex = () => ctex("flagTown", 256, 160, (g) => {
  g.fillStyle = "#f2e4c2"; g.fillRect(0, 0, 256, 160);
  g.fillStyle = "#d9a94e"; g.fillRect(0, 0, 52, 160); g.fillRect(204, 0, 52, 160);
  g.fillStyle = "#3f6fb5"; g.beginPath(); g.moveTo(128, 34); g.lineTo(178, 80); g.lineTo(128, 126); g.lineTo(78, 80); g.closePath(); g.fill();
  g.strokeStyle = "rgba(60,45,30,0.45)"; g.lineWidth = 3; g.stroke();
  g.fillStyle = "rgba(255,255,255,0.22)"; g.beginPath(); g.moveTo(78, 80); g.lineTo(128, 34); g.lineTo(128, 126); g.closePath(); g.fill();
  g.fillStyle = "rgba(120,100,90,0.10)"; g.fillRect(0, 150, 256, 10);
});

// ---------------- the street's shared materials ----------------
const M = {
  cobble: () => lam("cobbleHD", () => ({ map: cobbleHD() })),
  grass: () => lam("grassHD", () => ({ map: grassHD() })),
  wall: () => lam("wallHD", () => ({ map: stoneHD("wallHD") })),
  cope: () => lam("copeHD", () => ({ map: stoneHD("copeHD") })),
  church: () => lam("churchHD", () => ({ map: churchHD() })),
  step: () => lam("stepHD", () => ({ map: stoneHD("stepHD") })),
  planks: () => lam("planksHD", () => ({ map: planksHD() })),
  deckSide: () => lam("deckSide2", () => ({ map: beam() })),
  wood: () => lam("wood2", () => ({ map: beam() })),
  beam: () => lam("beam2", () => ({ map: beam() })),
  bed: () => lam("bed2", () => ({ map: bed() })),
  iron: () => twoTone(new THREE.MeshPhongMaterial({ color: "#6a6f79", specular: "#8a8a8a", shininess: 40 }), 0.15),
  crate: () => lam("crate", () => ({ map: crateHD() })),
  barrel: () => lam("barrel", () => ({ map: barrelHD() })),
  sack: () => lam("sack", () => ({ map: sackHD() })),
  bread: () => lam("bread", () => ({ map: breadHD() })),
  ivy: () => lam("ivy", () => ({ map: ivyTex(), side: THREE.DoubleSide, alphaTest: 0.5 })),
};

// ---------------- bakery block (z ~ +26..+36, +x side) ----------------
/** bakery: warm two-storey house, shopfront with awning + valance, bread in the window, flour sacks, a hanging sign */
const bakery = (b: Batch, kit: Kit, x: number, z: number, yaw: number) => {
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z);
  const w = 9, d = 8, h = 8.4, hw = w / 2, hd = d / 2;
  house(b, x, z, yaw, w, d, h, 1);
  // shopfront panel pressed onto the street face (local +z), with an awning over it and bread in the window
  b.add(quad(V(-4.0, 0, hd + 0.02), V(4.0, 0, hd + 0.02), V(4.0, 2.5, hd + 0.02), V(-4.0, 2.5, hd + 0.02)), lam("shopHD", () => ({ map: bakeryShopHD() })), m);
  // awning: sloped canvas from the wall (2.9 m) out to 2.4 m, with a scalloped valance
  const aw = 3.0, out = 1.7, zf = hd + out;
  b.add(quadN(V(-3.4, 2.9, hd + 0.05), V(3.4, 2.9, hd + 0.05), V(3.4, 2.35, zf), V(-3.4, 2.35, zf), V(0, 1, 0), 3.4, out / 1.4), lam("awning", () => ({ map: awningHD(), side: THREE.DoubleSide })), m);
  b.add(quad(V(-3.4, 2.35, zf), V(3.4, 2.35, zf), V(3.4, 1.9, zf), V(-3.4, 1.9, zf)), lam("valance", () => ({ map: valanceHD(), side: THREE.DoubleSide, alphaTest: 0.5 })), m);
  for (const sx of [-3.35, 3.35]) b.add(boxGeo(V(sx - 0.05, 0, hd), V(sx + 0.05, 2.95, hd + 0.06), 1), M.wood(), m);
  // bread in the window (a rack panel just inside the glass, lit warm)
  b.add(quad(V(-2.2, 0.9, hd - 0.06), V(2.2, 0.9, hd - 0.06), V(2.2, 2.4, hd - 0.06), V(-2.2, 2.4, hd - 0.06)), lam("bread", () => ({ map: breadHD() })), m);
  // flour sacks stacked by the door
  for (const [sx, sz, hh, yy] of [[-4.6, hd - 0.6, 0.9, 0], [-5.3, hd - 0.4, 0.8, 0], [-4.9, hd - 0.6, 0.7, 0.85]] as const) {
    b.add(boxGeo(V(sx - 0.42, yy, sz - 0.4), V(sx + 0.42, yy + hh, sz + 0.4), 0.84, true), M.sack(), m);
  }
  // hanging sign on a bracket beside the door (board faces the street)
  b.add(boxGeo(V(3.4, 3.3, hd + 0.02), V(4.3, 3.42, hd + 0.12), 1), M.wood(), m);
  b.add(boxGeo(V(3.9, 3.14, hd + 0.08), V(3.98, 3.34, hd + 0.9), 1), M.iron(), m);
  b.add(quadN(V(3.4, 2.3, hd + 0.86), V(4.3, 2.3, hd + 0.86), V(4.3, 3.2, hd + 0.86), V(3.4, 3.2, hd + 0.86), V(0, 0, 1)),
    lam("signHD", () => ({ map: signHD(), side: THREE.DoubleSide, alphaTest: 0.5 })), m);
  // barrels of flour by the step
  for (const [sx, sz] of [[5.4, hd - 0.7], [6.1, hd - 1.4]] as const) b.add(boxGeo(V(sx - 0.42, 0, sz - 0.42), V(sx + 0.42, 0.95, sz + 0.42), 0.86, true), M.barrel(), m);
  // bread racks under the awning, out on the pavement
  for (const zz of [-1.2, 1.4]) {
    const rack = new THREE.Matrix4().compose(V(0, 0, 0), yawQ(yaw), V(1, 1, 1));
    b.add(quad(V(-2.2, 0.95, hd + 0.35 + zz), V(2.2, 0.95, hd + 0.35 + zz), V(2.2, 2.15, hd + 0.35 + zz), V(-2.2, 2.15, hd + 0.35 + zz)), M.bread(), m.clone().multiply(rack));
    b.add(boxGeo(V(-2.3, 0.85, hd + 0.3 + zz), V(2.3, 0.95, hd + 0.42 + zz), 1), M.wood(), m);
  }
};

// ---------------- market (z ~ +6..+22) ----------------
/** painted canvas stall: 4 posts, a sloped canvas roof, a scalloped valance, a plank table and its wares */
const stall = (b: Batch, kit: Kit, x: number, z: number, yaw: number, col: string, kind: number) => {
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, streetY(z), z);
  const w = 2.6, out = 1.5, zf = out, zh = out; // local +z faces the street
  const roofMatS = lam("stall" + col, () => ({ map: stallHD(col), side: THREE.DoubleSide }));
  const valMatS = lam("stallVal" + col, () => ({ map: stallValance(col), side: THREE.DoubleSide, alphaTest: 0.5 }));
  for (const [sx, sz] of [[-w / 2, 0], [w / 2, 0], [-w / 2, zf], [w / 2, zf]] as const)
    b.add(boxGeo(V(sx - 0.06, 0, sz - 0.06), V(sx + 0.06, 2.5, sz + 0.06), 1), M.wood(), m);
  b.add(quadN(V(-w / 2 - 0.15, 2.5, -0.1), V(w / 2 + 0.15, 2.5, -0.1), V(w / 2 + 0.15, 2.15, zh + 0.15), V(-w / 2 - 0.15, 2.15, zh + 0.15), V(0, 1, 0), 1.4, 0.6), roofMatS, m);
  b.add(quad(V(-w / 2 - 0.15, 2.15, zh + 0.15), V(w / 2 + 0.15, 2.15, zh + 0.15), V(w / 2 + 0.15, 1.78, zh + 0.15), V(-w / 2 - 0.15, 1.78, zh + 0.15)), valMatS, m);
  b.add(boxGeo(V(-w / 2 - 0.05, 0.82, 0.2), V(w / 2 + 0.05, 0.9, 0.2 + zh - 0.1), 1.2), M.wood(), m); // table top
  b.add(boxGeo(V(-w / 2 + 0.1, 0, 0.3), V(-w / 2 + 0.2, 0.82, 0.4), 1), M.wood(), m);
  b.add(boxGeo(V(w / 2 - 0.2, 0, 0.3), V(w / 2 - 0.1, 0.82, 0.4), 1), M.wood(), m);
  if (kind === 0) { // produce: crates of apples/carrots, a barrel
    for (let i = 0; i < 3; i++) b.add(boxGeo(V(-w / 2 + 0.2 + i * 0.85, 0.9, 0.3), V(-w / 2 + 0.2 + i * 0.85 + 0.6, 1.28, 0.9), 0.6, true), M.crate(), m);
    b.add(boxGeo(V(w / 2 - 0.5, 0.9, 0.35), V(w / 2 - 0.1, 1.35, 0.75), 0.45, true), lam("apples", () => ({ color: "#c8443c" })), m);
    b.add(boxGeo(V(-w / 2 - 0.4, 0, zf - 0.9), V(-w / 2 + 0.4, 0.9, zf - 0.1), 0.8, true), M.barrel(), m);
  } else if (kind === 1) { // cloth / pots
    b.add(quadN(V(-w / 2 + 0.3, 0.92, 0.35), V(w / 2 - 0.3, 0.92, 0.35), V(w / 2 - 0.3, 0.92, 1.05), V(-w / 2 + 0.3, 0.92, 1.05), V(0, 1, 0), 1, 1), lam("stallCloth", () => ({ color: "#3f6fb5" })), m);
    for (let i = 0; i < 3; i++) b.add(new THREE.CylinderGeometry(0.16, 0.13, 0.22, 12).translate(0, 0.11, 0), lam("pot", () => ({ color: "#b5643c" })), m.clone().multiply(new THREE.Matrix4().makeTranslation(-w / 2 + 0.5 + i * 0.7, 1.04, 0.7)));
  } else { // bread / baskets
    for (let i = 0; i < 3; i++) b.add(quad(V(-w / 2 + 0.25 + i * 0.8, 0.9, 0.3), V(-w / 2 + 0.25 + i * 0.8 + 0.62, 0.9, 0.3), V(-w / 2 + 0.25 + i * 0.8 + 0.62, 0.9, 0.95), V(-w / 2 + 0.25 + i * 0.8, 0.9, 0.95)), M.bread(), m);
    b.add(boxGeo(V(w / 2 - 0.55, 0, 0.2), V(w / 2 - 0.05, 0.9, 0.7), 0.6, true), M.crate(), m);
  }
};
/** a stone trough fed by a spout, with a still water disc */
const fountain = (b: Batch, x: number, z: number) => {
  const y = streetY(z);
  b.add(boxGeo(V(x - 1.1, y, z - 0.7), V(x + 1.1, y + 0.65, z + 0.7), 1.4, true), M.step(), undefined);
  b.add(boxGeo(V(x - 1.0, y + 0.65, z - 0.6), V(x + 1.0, y + 0.68, z + 0.6), 1.4), lam("troughWater", () => ({ color: "#3f8fb0" })));
  b.add(boxGeo(V(x - 0.18, y + 0.68, z - 0.95), V(x + 0.18, y + 2.5, z - 0.75), 1.2), M.wall());
  b.add(boxGeo(V(x - 0.08, y + 2.3, z - 0.78), V(x + 0.08, y + 2.36, z - 0.55), 0.3), M.iron());
};
/** bunting strung across the street: two ropes of pennants at market height */
const bunting = (b: Batch, z: number, y0: number, sag = 0.5) => {
  const cols = ["#d23b3b", "#f3d35a", "#3f6fb5", "#f7f1e1", "#2f8a4f"];
  const n = 22, x0 = -STREET_HALF - 1.2, x1 = STREET_HALF + 1.2;
  for (let i = 0; i <= 20; i++) { // rope
    const u = i / 20, xa = x0 + (x1 - x0) * u, xb = x0 + (x1 - x0) * ((i + 1) / 20);
    const ya = y0 - sag * 4 * u * (1 - u), yb = y0 - sag * 4 * ((i + 1) / 20) * (1 - (i + 1) / 20);
    b.add(quadN(V(xa, ya + 0.03, z), V(xb, yb + 0.03, z), V(xb, yb - 0.03, z), V(xa, ya - 0.03, z), V(0, 0, 1), 1, 1),
      lam("buntingRope", () => ({ color: "#8a6a4a", side: THREE.DoubleSide })));
  }
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, x = x0 + (x1 - x0) * u, y = y0 - sag * 4 * u * (1 - u);
    b.add(tri(V(x - 0.16, y, z), V(x + 0.16, y, z), V(x, y - 0.5, z)),
      lam("pen" + cols[i % 5], () => ({ color: cols[i % 5], side: THREE.DoubleSide })));
  }
};
// ---------------- the stone arch bridge (river runs along x, the bridge crosses it along z) ----------------
/** three segmental arches along z; each { za, zb, ys, rise } (za > zb), springing at ys, crown at ys + rise. */
const ARCHES = [
  { za: -15.2, zb: -18.6, ys: -2.0, rise: 1.7 },
  { za: -18.6, zb: -25.4, ys: -3.0, rise: 3.0 },
  { za: -25.4, zb: -28.8, ys: -2.2, rise: 2.0 },
];
const BR_HW = 2.75, BED_Y = -8;
const archY = (a: (typeof ARCHES)[number], z: number) => {
  const zc = (a.za + a.zb) / 2, hz = (a.za - a.zb) / 2, u = Math.abs(z - zc) / hz;
  return a.ys + a.rise * Math.sqrt(Math.max(0, 1 - u * u));
};
/** height of the masonry bottom (the top of the opening) at z: the arches inside their spans, else the springing */
const openTop = (z: number) => {
  let m = -1e9;
  for (const a of ARCHES) m = Math.max(m, a.zb <= z && z <= a.za ? archY(a, z) : a.ys);
  return Math.min(m, streetY(z) - 0.25);
};
/** a vertical band at fixed x with bottom / top following z (spandrel walls, parapets, cornices) */
const vertBand = (x: number, dir: number, zA: number, zB: number, yLo: (z: number) => number, yHi: (z: number) => number, n = 24, k = 0.25) => {
  const gs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const za = zA + ((zB - zA) * i) / n, zb = zA + ((zB - zA) * (i + 1)) / n;
    gs.push(quadN(V(x, yLo(za), za), V(x, yLo(zb), zb), V(x, yHi(zb), zb), V(x, yHi(za), za), V(dir, 0, 0), Math.abs(zb - za) * k, (yHi(za) - yLo(za)) * k));
  }
  return mergeGeometries(gs, false);
};
const bridgeSet = (b: Batch, kit: Kit) => {
  const zA = RIVER_Z1, zB = RIVER_Z0; // -12 .. -32
  b.add(strip(-BR_HW, BR_HW, zA, zB, streetY, 0.5), M.planks());
  for (const s of [-1, 1]) {
    b.add(vertBand(s * BR_HW, s, zA, zB, openTop, (z) => streetY(z) - 0.02), M.wall());          // spandrel walls (arch profile)
    b.add(vertBand(s * (BR_HW + 0.28), s, zA, zB, (z) => streetY(z) - 0.02, (z) => streetY(z) + 1.0), M.wall()); // parapet outer
    b.add(vertBand(s * BR_HW, -s, zA, zB, (z) => streetY(z) - 0.02, (z) => streetY(z) + 1.0), M.wall());        // parapet inner
    b.add(strip(s * BR_HW, s * (BR_HW + 0.28), zA, zB, (z) => streetY(z) + 1.0), M.cope());                     // parapet top
    b.add(strip(s * BR_HW, s * (BR_HW + 0.28), zA, zB, (z) => streetY(z) + 1.0), M.cope());
    b.add(vertBand(s * (BR_HW + 0.45), s, zA, zB, (z) => streetY(z) - 0.2, (z) => streetY(z) + 0.05), M.cope()); // cornice
  }
  for (const a of ARCHES) { // arch soffit (the underside of each opening) faces down
    const gs: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 16; i++) {
      const z0 = a.za + ((a.zb - a.za) * i) / 16, z1 = a.za + ((a.zb - a.za) * (i + 1)) / 16;
      gs.push(quadN(V(-BR_HW, archY(a, z0), z0), V(BR_HW, archY(a, z0), z0), V(BR_HW, archY(a, z1), z1), V(-BR_HW, archY(a, z1), z1), V(0, -1, 0), 2 * BR_HW * 0.25, Math.abs(z1 - z0) * 0.25));
    }
    b.add(mergeGeometries(gs, false), M.wall());
  }
  for (const zc of [-14.4, -29.6]) { // abutment piers into the bed + cutwaters on each side
    b.add(boxGeo(V(-BR_HW, BED_Y, zc - 0.9), V(BR_HW, -2.0, zc + 0.9), 2), M.wall());
    for (const s of [-1, 1]) {
      b.add(boxGeo(V(s * BR_HW, BED_Y, zc - 0.7), V(s * (BR_HW + 0.6), -1.6, zc + 0.7), 2), M.wall());
      b.add(tri(V(s * (BR_HW + 0.6), -1.6, zc - 0.7), V(s * (BR_HW + 0.6), -1.6, zc + 0.7), V(s * (BR_HW + 0.6), 0.2, zc)), M.wall());
    }
  }
  // lamps at each end of the bridge
  for (const [lx, lz] of [[-BR_HW - 0.75, zA + 0.5], [BR_HW + 0.75, zA + 0.5], [-BR_HW - 0.75, zB - 0.5], [BR_HW + 0.75, zB - 0.5]] as const)
    prop(b, kit, "lantern", lx, streetY(lz), lz, 2.6);
};

// ---------------- the jettied lane (z ~ -9..+3): upper storeys overhang, laundry lines, a hand cart ----------------
const laneHouse = (b: Batch, side: number, z: number, w: number, h: number, si: number) => {
  const st = stOf(STYLES, si), x = side * 7.6, hw = w / 2;
  house(b, x, z, side < 0 ? Math.PI / 2 : -Math.PI / 2, w, 7, h, si);
  // jetty: an upper storey overhanging the street by 1.5 m, with a facade of its own
  const jy = 3.3, jh = h - jy - 1.0, jx0 = side * 6.1, jx1 = side * 7.6;
  const jm = new THREE.Matrix4().makeRotationY(side < 0 ? Math.PI / 2 : -Math.PI / 2).setPosition(x, 0, z);
  const jf = lam(`jf${si}_${w}`, () => ({ map: facadeHD(`jf${si}_${w}`, w, jh, st) }));
  b.add(quadN(V(-hw, jy, 3.5), V(hw, jy, 3.5), V(hw, jy + jh, 3.5), V(-hw, jy + jh, 3.5), V(0, 0, 1)), jf, jm);
  b.add(boxGeo(V(Math.min(jx0, jx1), jy - 0.25, z - hw - 0.3), V(Math.max(jx0, jx1), jy + jh, z + hw + 0.3), 2), lam("wall" + st.wall, () => ({ color: st.wall })), new THREE.Matrix4());
  b.add(boxGeo(V(Math.min(jx0, jx1) - 0.1, jy - 0.45, z - hw - 0.4), V(Math.max(jx0, jx1), jy - 0.2, z + hw + 0.4), 2), M.wood(), new THREE.Matrix4());
  for (const s of [-1, 1]) b.add(boxGeo(V(side * 6.1, jy, z + s * (hw + 0.1) - 0.12), V(side * 7.6, jy + jh, z + s * (hw + 0.1) + 0.12), 2), lam("wall" + st.wall, () => ({ color: st.wall })), new THREE.Matrix4());
};
const laundryLine = (b: Batch, z: number, y: number, seed: number) => {
  const r = rng(seed), cols = ["#f0e6d2", "#c96a6a", "#6a90c0", "#e0c46a", "#8fbf8a"];
  b.add(quadN(V(-6.0, y, z), V(6.0, y, z), V(6.0, y - 0.04, z), V(-6.0, y - 0.04, z), V(0, 0, 1), 1, 1), lam("laundryRope", () => ({ color: "#6a5a44", side: THREE.DoubleSide })));
  for (let i = 0; i < 7; i++) {
    const x = -5.4 + i * 1.7 + r() * 0.4, w = 0.55 + r() * 0.5, hh = 0.6 + r() * 0.55;
    b.add(quadN(V(x - w, y - 0.05, z), V(x + w, y - 0.05, z), V(x + w, y - 0.05 - hh, z), V(x - w, y - 0.05 - hh, z), V(0, 0, 1), 1, 1),
      lam("wash" + cols[i % 5], () => ({ color: cols[i % 5], side: THREE.DoubleSide })));
  }
};
/** two-wheel hand cart tipped up across the lane so its axle blocks the way (shot 3) */
const handCart = (b: Batch, x: number, z: number) => {
  const y = streetY(z), wheel = (cx: number) => {
    const Mw = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(cx, y + 1.15, z);
    b.add(new THREE.TorusGeometry(0.72, 0.1, 8, 22), M.wood(), Mw);
    for (let i = 0; i < 8; i++) b.add(boxGeo(V(-0.05, -0.66, -0.05), V(0.05, 0.66, 0.05), 1), M.wood(), Mw.clone().multiply(new THREE.Matrix4().makeRotationX((i * Math.PI) / 4)));
    b.add(new THREE.CylinderGeometry(0.13, 0.13, 0.24, 12).rotateZ(Math.PI / 2), M.iron(), Mw);
  };
  wheel(x - 1.5); wheel(x + 1.5);
  b.add(boxGeo(V(x - 1.6, y + 1.05, z - 0.08), V(x + 1.6, y + 1.25, z + 0.08), 1), M.wood());   // axle beam across the lane
  b.add(quadN(V(x - 1.35, y + 1.3, z - 0.1), V(x + 1.35, y + 1.3, z - 0.1), V(x + 1.35, y + 2.2, z - 1.7), V(x - 1.35, y + 2.2, z - 1.7), V(0, 1, 0), 2.7, 1.6), M.planks()); // tipped bed
  b.add(boxGeo(V(x - 1.35, y + 1.05, z - 1.85), V(x + 1.35, y + 1.2, z - 0.1), 1), M.wood());    // under-frame
  for (const sx of [-0.62, 0.62]) b.add(boxGeo(V(x + sx - 0.06, y + 0.06, z + 0.2), V(x + sx + 0.06, y + 1.14, z + 1.9), 1), M.wood()); // shafts on the ground
  b.add(boxGeo(V(x - 0.55, y + 1.35, z - 1.55), V(x + 0.55, y + 2.05, z - 0.75), 0.7, true), M.crate()); // a crate on the bed
};

// ---------------- the climb (z -44..-58): retaining walls, hand rail, ivy, terraces ----------------
const climbWalls = (b: Batch, kit: Kit) => {
  const wx = 4.6, zA = RAMP0 + 1, zB = RAMP1 - 1;
  for (const s of [-1, 1]) {
    b.add(vertBand(s * wx, -s, zA, zB, streetY, (z) => streetY(z) + 0.95), M.wall());     // wall face (toward the street)
    b.add(strip(s * wx, s * (wx + 0.28), zA, zB, (z) => streetY(z) + 0.95), M.cope());    // coping
    b.add(vertBand(s * (wx + 0.28), s, zA, zB, streetY, (z) => streetY(z) + 0.95), M.wall());
    // ivy on the face
    for (let z = zB + 1; z < zA - 1; z += 3.1) {
      const gy = streetY(z) + 0.9;
      b.add(quadN(V(s * wx - s * 0.02, streetY(z), z), V(s * wx - s * 0.02, gy, z), V(s * wx - s * 0.02, gy, z + 2.4), V(s * wx - s * 0.02, streetY(z), z + 2.4), V(-s, 0, 0), 1, 1), M.ivy());
    }
    // hand rail: posts + a top rail following the slope
    for (let z = zB; z <= zA; z += 2.2) b.add(boxGeo(V(s * (wx + 0.9) - 0.05, streetY(z), z - 0.05), V(s * (wx + 0.9) + 0.05, streetY(z) + 1.0, z + 0.05), 1), M.wood());
    const rp: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) {
      const z0 = zA + ((zB - zA) * i) / 9, z1 = zA + ((zB - zA) * (i + 1)) / 9;
      rp.push(quadN(V(s * (wx + 0.9) - 0.05, streetY(z0) + 1.0, z0), V(s * (wx + 0.9) - 0.05, streetY(z1) + 1.0, z1), V(s * (wx + 0.9) + 0.05, streetY(z1) + 1.06, z1), V(s * (wx + 0.9) + 0.05, streetY(z0) + 1.06, z0), V(0, 1, 0), 0.05, Math.abs(z1 - z0) * 0.5));
    }
    b.add(mergeGeometries(rp, false), M.wood());
  }
  // terrace houses above each retaining wall, up the climb
  for (const s of [-1, 1]) {
    let z = RAMP1 + 1;
    while (z < RAMP0 - 3) {
      const w = 6 + (z % 3), h = 7.6;
      terraceRow(b, s, z, w, h, Math.floor(z));
      z += w + 0.6;
    }
  }
};
/** a terrace house: its street-facing front plane sits at |x| = fx, over a plain box with terraceHD on the front;
 *  `fy` lifts the row onto the climb's terrace (whose coping is 0.95 m above the street). */
const terraceRow = (b: Batch, side: number, z: number, w: number, h: number, si: number, fx = 6.4, fy = 0.95) => {
  const st = stOf(STYLES_T, si), hw = w / 2, dep = 7.5, x = side * (fx + dep / 2), y = streetY(z) + fy;
  const m = new THREE.Matrix4().makeRotationY(side < 0 ? Math.PI / 2 : -Math.PI / 2).setPosition(x, y, z);
  b.add(quadN(V(-hw, 0, dep / 2), V(hw, 0, dep / 2), V(hw, h, dep / 2), V(-hw, h, dep / 2), V(0, 0, 1)), lam(`tr${side}_${si}_${w}`, () => ({ map: terraceHD(`tr${side}_${si}_${w}`, w, h, st) })), m);
  b.add(boxGeo(V(Math.min(side * fx, side * (fx + dep)), y, z - hw - 0.02), V(Math.max(side * fx, side * (fx + dep)), y + h, z + hw + 0.02), 2), lam("wall" + st.wall, () => ({ color: st.wall })), new THREE.Matrix4());
  b.add(boxGeo(V(Math.min(side * fx, side * (fx + dep)), y + h - 0.4, z - hw - 0.6), V(Math.max(side * fx, side * (fx + dep)), y + h + hw * 0.7, z + hw + 0.6), 2), roofMat(st.roof ?? "#c9775a"), new THREE.Matrix4());
  b.add(boxGeo(V(Math.min(side * (fx - 0.06), side * (fx + 0.02)), y, z - hw - 0.05), V(Math.max(side * (fx - 0.06), side * (fx + 0.02)), y + 0.3, z + hw + 0.05), 1), M.step(), new THREE.Matrix4());
};
// ===================================================================================================================
// church terrace (z -58..-95): cobbled square, lychgate, churchyard, the church and the detached campanile
// ===================================================================================================================
const CHURCH = { x0: -8.5, x1: 8.5, z0: Z_DOOR, z1: -95, h: 9.5, ridge: 5.6, dx: 1.0, dhw: 1.2, dh: 4.2 };
/** the detached bell tower: `pivotY` carries the bell, `doorZ` the rope's threshold out on the street side */
export const CAMPANILE = {
  x: -7.2, z: Z_TOWER, hw: 2.2, wall: 0.72, baseH: 8.0, belfryH: 4.2,
  pivotY: RAMP_H + 11.2, doorX: -6.9, doorHW: 0.7, doorH: 2.8, clockY: RAMP_H + 6.3,
  ropeEnd: [-6.55, RAMP_H + 0.5, Z_TOWER + 3.4] as [number, number, number],
};
/** the only pieces world.ts animates: the bell (swings about z), its rope and the three clock faces */
export type Dyn = {
  bellPivot: THREE.Group; bell: THREE.Mesh; bellMat: THREE.MeshLambertMaterial;
  hook: THREE.Vector3; rope: Strand; ropeEnd: THREE.Vector3;
  clocks: THREE.Mesh[]; clockMats: THREE.MeshLambertMaterial[];
};
/** the bell's silhouette: crown on top, a long flare to the mouth, hollowed back up the inside */
const bellGeo = () => {
  const P: [number, number][] = [[0.0, 0.02], [0.13, 0.0], [0.24, -0.12], [0.31, -0.32], [0.355, -0.62], [0.375, -0.92],
    [0.43, -1.18], [0.5, -1.34], [0.46, -1.37], [0.4, -1.24], [0.335, -0.9], [0.26, -0.52], [0.16, -0.24], [0.06, -0.12], [0.0, -0.1]];
  const g = new THREE.LatheGeometry(P.map(([x, y]) => new THREE.Vector2(x, y)), 28);
  g.computeVertexNormals();
  return g;
};

/** the campanile: hollow base with a doorway, an open belfry of four piers, a cornice and a squat spire */
const campanile = (b: Batch, root: THREE.Object3D, dyn: Dyn) => {
  const C = CAMPANILE, bx = C.x, bz = C.z, hw = C.hw, t = C.wall;
  const y0 = RAMP_H, y1 = y0 + C.baseH, y2 = y1 + C.belfryH, stone = M.church(), px = hw - t / 2;
  // base: four walls round a hollow shaft, a doorway on the +z face for the rope and the ringer
  b.add(boxGeo(V(bx - hw, y0, bz - hw), V(bx + hw, y1, bz - hw + t), 2), stone);
  b.add(boxGeo(V(bx - hw, y0, bz - hw), V(bx - hw + t, y1, bz + hw), 2), stone);
  b.add(boxGeo(V(bx + hw - t, y0, bz - hw), V(bx + hw, y1, bz + hw), 2), stone);
  const dz = bz + hw, dx = C.doorX, dw = C.doorHW, dh = C.doorH;
  b.add(boxGeo(V(bx - hw, y0, dz - t), V(dx - dw, y1, dz), 2), stone);
  b.add(boxGeo(V(dx + dw, y0, dz - t), V(bx + hw, y1, dz), 2), stone);
  b.add(boxGeo(V(dx - dw, y0 + dh, dz - t), V(dx + dw, y1, dz), 2), stone);
  b.add(boxGeo(V(bx - hw - 0.18, y1 - 0.45, bz - hw - 0.18), V(bx + hw + 0.18, y1 + 0.15, bz + hw + 0.18), 2), M.cope());
  // belfry: four piers, lintels on every side, a sill balustrade so the bell reads above it
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    b.add(boxGeo(V(bx + sx * px - t / 2, y1, bz + sz * px - t / 2), V(bx + sx * px + t / 2, y2, bz + sz * px + t / 2), 2), stone);
  for (const sz of [-1, 1]) b.add(boxGeo(V(bx - hw, y2 - 0.55, bz + sz * px - t / 2), V(bx + hw, y2, bz + sz * px + t / 2), 2), stone);
  for (const sx of [-1, 1]) b.add(boxGeo(V(bx + sx * px - t / 2, y2 - 0.55, bz - hw), V(bx + sx * px + t / 2, y2, bz + hw), 2), stone);
  for (const sz of [-1, 1]) b.add(boxGeo(V(bx - hw, y1, bz + sz * px - t / 2 - 0.06), V(bx + hw, y1 + 0.8, bz + sz * px + t / 2 + 0.06), 2), stone);
  for (const s of [-1, 1]) b.add(boxGeo(V(bx + s * px - t / 2 - 0.06, y1, bz - hw), V(bx + s * px + t / 2 + 0.06, y1 + 0.8, bz + hw), 2), stone);
  b.add(boxGeo(V(bx - hw - 0.3, y2, bz - hw - 0.3), V(bx + hw + 0.3, y2 + 0.5, bz + hw + 0.3), 2), M.cope());
  const sp = new THREE.ConeGeometry(3.05, 3.6, 4); sp.rotateY(Math.PI / 4);
  b.add(sp, roofMat("#8f97a8"), new THREE.Matrix4().makeTranslation(bx, y2 + 0.5 + 1.8, bz));
  b.add(boxGeo(V(bx - 0.06, y2 + 4.1, bz - 0.06), V(bx + 0.06, y2 + 5.3, bz + 0.06), 1), M.iron());
  // the beam the bell swings on (along z, so the swing is across the belfry opening seen from the street)
  b.add(boxGeo(V(bx - 0.3, C.pivotY - 0.18, bz - hw), V(bx + 0.3, C.pivotY + 0.18, bz + hw), 1.5), M.beam());
  // the bell + its rope (the two animated pieces)
  const bronze = lam("bellBronze", () => ({ color: "#c08a2c", side: THREE.DoubleSide }));
  const pivot = new THREE.Group(); pivot.position.set(bx, C.pivotY, bz);
  const bell = new THREE.Mesh(bellGeo(), bronze); bell.position.set(0, -0.34, 0); bell.receiveShadow = true;
  pivot.add(bell); root.add(pivot);
  const rope = new Strand(14, 0.085, 0.085, lam("bellRope", () => ({ color: "#8a5a34" })), 1, false);
  root.add(rope.mesh);
  dyn.bellPivot = pivot; dyn.bell = bell; dyn.bellMat = bronze;
  dyn.hook = new THREE.Vector3(0.47, -1.45, 0); dyn.rope = rope; dyn.ropeEnd = new THREE.Vector3(...C.ropeEnd);
};
/** the clock: two faces (street side and square side) whose material world.ts swaps 11:58 / 11:59 / 12:00 */
const clockFaces = (root: THREE.Object3D, dyn: Dyn) => {
  const C = CAMPANILE, d = 2.3, y = C.clockY;
  dyn.clockMats = [58, 59, 60].map((m) => lam("clock" + m, () => ({ map: clockHD(m) })));
  const face = (px: number, py: number, pz: number, ry: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(d, d), dyn.clockMats[0]);
    m.position.set(px, py, pz); m.rotation.y = ry; m.receiveShadow = true;
    root.add(m); dyn.clocks.push(m);
  };
  face(C.x, y, C.z + C.hw + 0.04, 0);
  face(C.x + C.hw + 0.04, y, C.z, Math.PI / 2);
};

/** the church: aisleless nave along z, a gable to the street, a recessed west door and stepped buttresses */
const churchNave = (b: Batch) => {
  const { x0, x1, z0, z1, h, ridge, dx, dhw, dh } = CHURCH, y = RAMP_H, ys = y + h, cx = (x0 + x1) / 2, zc = (z0 + z1) / 2, stone = M.church();
  b.add(wallX(x0, z1, z0, y, ys, -1, 0.25), stone);
  b.add(wallX(x1, z1, z0, y, ys, 1, 0.25), stone);
  b.add(wallZ(x0, x1, z1, y, ys, -1, 0.25), stone);
  b.add(wallZ(x0, dx - dhw, z0, y, ys, 1, 0.25), stone);
  b.add(wallZ(dx + dhw, x1, z0, y, ys, 1, 0.25), stone);
  b.add(wallZ(dx - dhw, dx + dhw, z0, y + dh, ys, 1, 0.25), stone);
  b.add(wallZ(dx - dhw, dx + dhw, z0 - 0.8, y, y + dh, 1, 0.25), lam("churchDoor", () => ({ color: "#6b4a2c" })));
  b.add(tri(V(x0, ys, z0), V(x1, ys, z0), V(cx, ys + ridge, z0)), stone);
  b.add(tri(V(x1, ys, z0), V(x1, ys, z1), V(x1, ys + ridge, zc)), stone);
  b.add(tri(V(x0, ys, z1), V(x0, ys, z0), V(x0, ys + ridge, zc)), stone);
  const rm = roofMat("#8f97a8"), o = 0.4;
  b.add(quadN(V(x1 + o, ys - 0.2, z0 - o), V(x1 + o, ys - 0.2, z1 + o), V(cx, ys + ridge, z1 + o), V(cx, ys + ridge, z0 - o), V(1, 0.5, 0), 4, 3), rm);
  b.add(quadN(V(x0 - o, ys - 0.2, z0 - o), V(x0 - o, ys - 0.2, z1 + o), V(cx, ys + ridge, z1 + o), V(cx, ys + ridge, z0 - o), V(-1, 0.5, 0), 4, 3), rm);
  // west door surround + the two steps down to the square
  for (const s of [-1, 1]) b.add(boxGeo(V(dx + s * (dhw + 0.3) - 0.16, y, z0 - 0.3), V(dx + s * (dhw + 0.3) + 0.16, y + dh + 0.5, z0 + 0.14), 1), M.cope());
  b.add(boxGeo(V(dx - dhw - 0.3, y + dh + 0.2, z0 - 0.3), V(dx + dhw + 0.3, y + dh + 0.5, z0 + 0.14), 1), M.cope());
  b.add(boxGeo(V(dx - dhw - 1.4, y, z0), V(dx + dhw + 1.4, y + 0.16, z0 + 1.0), 1.5), M.step());
  b.add(boxGeo(V(dx - dhw - 1.0, y, z0 + 1.0), V(dx + dhw + 1.0, y + 0.08, z0 + 1.7), 1.5), M.step());
  // buttresses up each side
  for (const s of [-1, 1]) for (let z = z0 - 3.2; z > z1 + 1; z -= 5.2) {
    b.add(boxGeo(V(Math.min(s * x1, s * (x1 + 1.0)), y, z - 0.55), V(Math.max(s * x1, s * (x1 + 1.0)), y + h * 0.62, z + 0.55), 2), stone);
    b.add(boxGeo(V(Math.min(s * x1, s * (x1 + 0.66)), y + h * 0.62, z - 0.42), V(Math.max(s * x1, s * (x1 + 0.66)), y + h * 0.9, z + 0.42), 2), stone);
    b.add(boxGeo(V(Math.min(s * x1, s * (x1 + 1.06)), y + h * 0.9, z - 0.6), V(Math.max(s * x1, s * (x1 + 1.06)), y + h * 0.98, z + 0.6), 2), M.cope());
  }
};

/** churchyard: a lychgate on the square's east side + a weathered row of headstones behind the nave */
const churchyard = (b: Batch, r: () => number) => {
  const y = RAMP_H, lx = 13, lz = -77;
  for (const sz of [-1.5, 1.5]) for (const sx of [-1.0, 1.0])
    b.add(boxGeo(V(lx + sx - 0.15, y, lz + sz - 0.15), V(lx + sx + 0.15, y + 2.4, lz + sz + 0.15), 1.5), M.wood());
  b.add(quadN(V(lx - 1.5, y + 2.4, lz - 1.9), V(lx + 1.5, y + 2.4, lz - 1.9), V(lx + 1.5, y + 3.2, lz), V(lx - 1.5, y + 3.2, lz), V(0, 0.6, -1), 2, 1.4), roofMat("#c9775a"));
  b.add(quadN(V(lx - 1.5, y + 2.4, lz + 1.9), V(lx + 1.5, y + 2.4, lz + 1.9), V(lx + 1.5, y + 3.2, lz), V(lx - 1.5, y + 3.2, lz), V(0, 0.6, 1), 2, 1.4), roofMat("#c9775a"));
  b.add(boxGeo(V(lx - 0.06, y + 3.2, lz - 0.06), V(lx + 0.06, y + 3.75, lz + 0.06), 1), M.iron());
  for (const sz of [-1.5, 1.5]) b.add(boxGeo(V(lx - 1.05, y + 1.5, lz + sz - 0.05), V(lx + 1.05, y + 1.75, lz + sz + 0.05), 1), M.wood());
  for (let i = 0; i < 16; i++) {
    const gx = -(11 + r() * 9), gz = -78 - r() * 14, hh = 0.7 + r() * 0.8, ww = 0.5 + r() * 0.35;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.14, (r() - 0.5) * 0.7, (r() - 0.5) * 0.14));
    b.add(boxGeo(V(-ww / 2, 0, -0.07), V(ww / 2, hh, 0.07), 1), M.step(), new THREE.Matrix4().compose(V(gx, y, gz), q, V(1, 1, 1)));
  }
  for (let i = 0; i < 5; i++) b.add(boxGeo(V(-14 - r() * 6, y, -80 - r() * 10), V(-13.4 - r() * 6, y + 1.1, -79.6 - r() * 10), 1.5), M.step());
};

// ===================================================================================================================
// ground, quays, the landmark blocks, the distant valley and the street assembler
// ===================================================================================================================
const Z_HEAD = 42, Z_TAIL = -96;
/** horizontal ground strip between two x edges (order-insensitive) at streetY(z) */
const gstrip = (b: Batch, xa: number, xb: number, zA: number, zB: number, mat: THREE.Material) =>
  b.add(strip(Math.min(xa, xb), Math.max(xa, xb), zA, zB, streetY, 0.25), mat);
/** the one walking surface: cobbled street + paving apron + grass beyond, both banks; the river is left as a hole */
const ground = (b: Batch) => {
  const cob = M.cobble(), gr = M.grass();
  for (const [zA, zB] of [[Z_HEAD, RIVER_Z1], [RIVER_Z0, RAMP1]] as const) {
    gstrip(b, -6.5, 6.5, zA, zB, cob);
    for (const s of [-1, 1]) gstrip(b, s * 6.5, s * 13, zA, zB, cob);
  }
  gstrip(b, -26, 26, RAMP1, Z_TAIL, cob);                       // the church square is one wide cobbled terrace
  for (const s of [-1, 1]) {
    gstrip(b, s * 13, s * 200, Z_HEAD, RIVER_Z1, gr);
    gstrip(b, s * 13, s * 200, RIVER_Z0, RAMP1, gr);
    gstrip(b, s * 26, s * 200, RAMP1, Z_TAIL, gr);
  }
  b.add(strip(-200, 200, 300, Z_HEAD, () => 0, 0.25), gr);        // green caps beyond both ends of the valley
  b.add(strip(-200, 200, Z_TAIL, -340, () => RAMP_H, 0.25), gr);
};
/** river walls at the two banks + their coping and the low parapets that fence the water off the street */
const quays = (b: Batch) => {
  for (const [zc, dir] of [[RIVER_Z1, -1], [RIVER_Z0, 1]] as const) {
    b.add(wallZ(-170, 170, zc, BED_Y, streetY(zc) + 0.02, dir, 0.25), M.wall());
    b.add(dir < 0 ? boxGeo(V(-170, streetY(zc), zc), V(170, streetY(zc) + 0.14, zc + 0.8), 2)
      : boxGeo(V(-170, streetY(zc), zc - 0.8), V(170, streetY(zc) + 0.14, zc), 2), M.cope());
  }
  for (const s of [-1, 1]) {
    const xa = s < 0 ? -170 : 3.4, xb = s < 0 ? -3.4 : 170;
    b.add(boxGeo(V(xa, streetY(RIVER_Z1), RIVER_Z1), V(xb, streetY(RIVER_Z1) + 0.95, RIVER_Z1 + 0.7), 2), M.wall());
    b.add(boxGeo(V(xa, streetY(RIVER_Z0), RIVER_Z0 - 0.7), V(xb, streetY(RIVER_Z0) + 0.95, RIVER_Z0), 2), M.wall());
  }
};
/** bakery block: the shop itself (awning, bread, sign, sacks) + a lamp and a flower box by the step */
const bakeryBlock = (b: Batch, kit: Kit) => {
  bakery(b, kit, 10, Z_BAKERY, -Math.PI / 2);
  prop(b, kit, "lantern", 5.7, streetY(Z_BAKERY + 5.0), Z_BAKERY + 5.0, 2.8);
  prop(b, kit, "plant_bushDetailed", 5.3, streetY(Z_BAKERY - 5.4), Z_BAKERY - 5.4, 1.0);
  prop(b, kit, "cart", 8.4, streetY(Z_BAKERY + 7.4), Z_BAKERY + 7.4, 2.2, -1.9);
};
/** market (z ~ +6..+22): two rows of canvas stalls, bunting, a trough and market clutter on the cobbles */
const market = (b: Batch, kit: Kit, r: () => number) => {
  const cols = ["#c0473f", "#3f6fb5", "#2f8a4f"];
  for (let i = 0; i < 4; i++) {
    const z = 20 - i * 3.4;
    stall(b, kit, 3.6, z, -Math.PI / 2, cols[i % 3], i % 3);
    stall(b, kit, -3.6, z - 1.7, Math.PI / 2, cols[(i + 1) % 3], (i + 1) % 3);
  }
  fountain(b, -3.2, 10.5);
  bunting(b, 21.5, streetY(21.5) + 4.6, 0.5);
  bunting(b, 9.0, streetY(9.0) + 4.6, 0.55);
  for (const [x, z, kind] of [[2.4, 18.4, 0], [-2.0, 15.2, 1], [2.6, 12.0, 0], [-2.4, 8.4, 1]] as const) {
    const y = streetY(z);
    if (kind === 0) b.add(boxGeo(V(x - 0.45, y, z - 0.45), V(x + 0.45, y + 0.85, z + 0.45), 0.9, true), M.crate());
    else b.add(boxGeo(V(x - 0.42, y, z - 0.42), V(x + 0.42, y + 0.95, z + 0.42), 0.86, true), M.barrel());
  }
  for (const [x, z] of [[2.2, 16.6], [-2.6, 19.2]] as const) b.add(boxGeo(V(x - 0.5, streetY(z), z - 0.5), V(x + 0.5, streetY(z) + 0.9, z + 0.5), 0.9, true), M.sack());
  prop(b, kit, "stall-bench", 2.4, streetY(14.0), 14.0, 1.0, -Math.PI / 2);
  prop(b, kit, "grass_large", -4.7, streetY(6.6), 6.6, 0.5);
  prop(b, kit, "cart", -2.4, streetY(17.4), 17.4, 2.2, 1.1 + r() * 0.2);
};
/** the lane (z ~ +3..-9): jettied storeys, laundry across the street, drainpipes and the hand cart that blocks it */
const laneBlock = (b: Batch, kit: Kit) => {
  const si = [3, 7, 1, 5];
  let i = 0;
  for (const z of [3, -1, -5, -9]) { laneHouse(b, i % 2 ? 1 : -1, z, 6.4, 7.4, si[i]); i++; }
  laundryLine(b, 1.5, streetY(1.5) + 4.4, 71);
  laundryLine(b, -7.5, streetY(-7.5) + 4.4, 72);
  handCart(b, 0, -10.4);
  for (const [z, s] of [[-2, -1], [-6, 1], [2, 1]] as const)
    b.add(boxGeo(V(s * 5.9, streetY(z), z - 0.09), V(s * 6.1, streetY(z) + 5.0, z + 0.09), 1), M.iron());
  prop(b, kit, "lantern", -5.4, streetY(-3), -3, 2.8);
  prop(b, kit, "plant_bushLarge", 5.2, streetY(-6), -6, 1.1);
};
/** the river (z -12..-32): lilies, two canoes and a pair of mooring posts by the quay */
const riverSet = (b: Batch, kit: Kit, r: () => number) => {
  for (let i = 0; i < 12; i++) prop(b, kit, "lily_large", (r() - 0.5) * 90, WATER_Y + 0.03, -13.5 - r() * 17, 0.12, r() * 6);
  prop(b, kit, "canoe", -22, WATER_Y + 0.02, -21, 0.7, 1.5);
  prop(b, kit, "canoe", 26, WATER_Y + 0.02, -24, 0.7, -1.2);
  for (const [x, z] of [[8, -13], [-11, -30.5]] as const) b.add(boxGeo(V(x - 0.16, WATER_Y, z - 0.16), V(x + 0.16, streetY(RIVER_Z1) + 0.4, z + 0.16), 1), M.wood());
};
/** one street-lining house run: fronts on |x| = 6, filling [z0, z1] with ordinary gabled houses */
const streetFront = (b: Batch, side: number, z0: number, z1: number, r: () => number) => {
  let z = z0 - 0.4;
  while (z > z1 + 3.2) {
    const w = 7 + Math.floor(r() * 3), h = [7, 8.4, 9.6][Math.floor(r() * 3)];
    house(b, side * 10, z - w / 2, side < 0 ? Math.PI / 2 : -Math.PI / 2, w, 8, h, Math.floor(r() * 8), streetY(z));
    z -= w + 0.3 + r() * 0.5;
  }
};
/** distant valley: hills that ring it, tree lines along both flanks, rooftops beyond each end, two windmills */
const distant = (b: Batch, kit: Kit, r: () => number) => {
  const hill = new THREE.SphereGeometry(1, 26, 13, 0, Math.PI * 2, 0, Math.PI / 2);
  const hm = [lam("hillA", () => ({ color: "#7cb45a" })), lam("hillB", () => ({ color: "#6da44e" })), lam("hillC", () => ({ color: "#8cc063" }))];
  for (const [x, z, sx, sy, sz] of [[-330, 210, 180, 46, 130], [150, 340, 220, 58, 150], [380, 120, 160, 42, 120],
    [-420, -110, 180, 40, 140], [-70, -360, 230, 52, 140], [300, -300, 200, 48, 130], [470, -50, 150, 36, 120]] as const)
    b.add(hill, hm[Math.abs(Math.round(x)) % 3], new THREE.Matrix4().compose(V(x, -2, z), new THREE.Quaternion(), V(sx, sy, sz)));
  const trees = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree-high-round", "tree"];
  for (let z = 60; z > -120; z -= 17) for (const s of [-1, 1]) prop(b, kit, trees[Math.abs(Math.round(z + s * 7)) % 6], s * (24 + r() * 26), streetY(z), z + r() * 6, 7 + r() * 3.5, r() * 6);
  for (let i = 0; i < 26; i++) {
    const back = r() < 0.5, z = back ? 60 + r() * 130 : -104 - r() * 130;
    prop(b, kit, trees[Math.floor(r() * 6)], (r() - 0.5) * 220, back ? 0 : RAMP_H, z, 8 + r() * 4, r() * 6);
  }
  for (const [z, y, n] of [[58, 0, 6], [-106, RAMP_H, 6]] as const)
    for (let i = 0; i < n; i++) house(b, (i - (n - 1) / 2) * 11 + (r() - 0.5) * 3, z - r() * 16, z > 0 ? Math.PI : 0, 7 + r() * 2, 8, 7 + r() * 2.5, Math.floor(r() * 8), y);
  prop(b, kit, "windmill", 96, streetY(-10), -10, 15, -0.6);
  prop(b, kit, "windmill", -120, 0, 88, 14, 1.2);
};

/** the ordinary frontage: [z0, z1] runs (both sides) that get street-lining houses between the landmarks */
export const PLACE: readonly (readonly [number, number])[] = [[42, 35], [25, 22.5], [6, 3.6], [-33, -43.5]];

/** build the whole street into `root` and hand world.ts the three animated pieces */
export const buildStreet = (root: THREE.Object3D, kit: Kit, rays: Ray[] = []): Dyn => {
  const b = new Batch(), r = rng(101);
  const dyn = { clocks: [], clockMats: [] } as unknown as Dyn;
  sight = []; // the street-lining set is never sight-line culled
  ground(b); quays(b);
  bakeryBlock(b, kit); market(b, kit, r); laneBlock(b, kit);
  bridgeSet(b, kit); climbWalls(b, kit); riverSet(b, kit, r);
  for (const [z0, z1] of PLACE) for (const s of [-1, 1]) streetFront(b, s, z0, z1, r);
  // the church terrace: nave + door, churchyard, campanile with its bell + clock, the square's houses
  churchNave(b); churchyard(b, r); campanile(b, root, dyn); clockFaces(root, dyn);
  for (let z = -60; z > -74; z -= 8.6) {
    terraceRow(b, 1, z - 4, 7.6, 8.2, Math.floor(z), 10.5, 0);
    terraceRow(b, -1, z - 4, 7.6, 8.2, Math.floor(z) + 3, 10.5, 0);
  }
  for (let z = -80; z > -92; z -= 8.6) terraceRow(b, 1, z - 4, 7.6, 8.2, Math.floor(z), 10.5, 0);
  fountain(b, 7, Z_SQUARE);
  sight = rays; // optional dressing beyond the street is culled against the film's sight lines
  distant(b, kit, r);
  b.build(root);
  sight = [];
  return dyn;
};


