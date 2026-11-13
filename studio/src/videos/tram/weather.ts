// weather.ts — the rain, everything it does when it lands, the water it leaves on the lens, and the light it
// smears across the flood. Owned by this file. Deterministic: every drop and every splash is a pure function of
// its index and the frame number, so a chunk machine reproduces the frame byte for byte.
import * as THREE from "three";
import { STREET, LAMPS, GLOW, FPS, tramZ, mulberry32, clamp, sat, hash1 } from "./contract";
import { rainStreak, splashRing, lensRain, streak, radial } from "./wet";
import { NOINK } from "../bridge/ink";

type Rain = { pts: THREE.Points; attr: THREE.BufferAttribute; lx: Float32Array; ly: Float32Array; lz: Float32Array; n: number; sp: number };
const YMIN = -8, YMAX = 14;

export class Weather {
  root = new THREE.Group();
  private rains: Rain[] = [];
  private spl: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; per: number; off: number; sc: number }[] = [];
  private glints: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; x: number; dz: number; w: number; onTram: boolean; ph: number; s: number }[] = [];
  private lens: THREE.Mesh;
  private lensMat: THREE.MeshBasicMaterial;
  private v = new THREE.Vector3();

  constructor() {
    const R = this.root;
    // ---- two rain systems: near (big, fast, sparse) and far (small, dense). Both live in camera space and are
    //      written into world space each frame from the camera's own basis, so the rain is always dense in frame.
    this.rains.push(this.rain(1400, 10.5, 0.30, 15.5, 2.2, 0.62));
    this.rains.push(this.rain(2200, 20.0, 0.16, 17.0, 1.5, 0.30));

    // ---- splashes on the flood: an expanding ring, sixty of them, each on its own phase
    const ringMat = memoRing();
    const rnd = mulberry32(7781);
    for (let i = 0; i < 72; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: ringMat, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color("#bcd2ee"), toneMapped: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      const x = -7 + rnd() * 14, z = -34 + rnd() * 50;
      m.rotation.x = -Math.PI / 2; m.position.set(x, STREET.waterY + 0.012, z); m.renderOrder = 5;
      m.layers.set(NOINK); R.add(m);
      this.spl.push({ m, mat, per: 0.55 + rnd() * 0.95, off: rnd() * 4, sc: 0.10 + rnd() * 0.16 });
    }

    // ---- glints: the saloon light smeared along the flood beside the tram, plus one under each gas lamp
    const stMat = memoStreak();
    const gr = mulberry32(9901);
    for (let c = 0; c < 4; c++) for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: stMat, color: new THREE.Color(GLOW.glintCol), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const w = 0.13 + gr() * 0.10, len = 0.9 + gr() * 1.7;
      const g = new THREE.PlaneGeometry(w, len); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, mat); m.renderOrder = 6; m.layers.set(NOINK); R.add(m);
      this.glints.push({ m, mat, x: 1.55 + c * 0.62 + gr() * 0.2, dz: -3.4 + i * 1.7 + gr() * 0.5, w, onTram: true, ph: gr() * 6.28, s: 0.5 + gr() * 0.5 });
    }
    for (const L of LAMPS) {
      const mat = new THREE.MeshBasicMaterial({ map: stMat, color: new THREE.Color(GLOW.lampWarm), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const g = new THREE.PlaneGeometry(0.5, 2.6); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, mat); m.renderOrder = 6; m.layers.set(NOINK); R.add(m);
      this.glints.push({ m, mat, x: L.x * 0.72, dz: L.z - 0.4, w: 0.5, onTram: false, ph: gr() * 6.28, s: 0.9 });
    }

    // ---- rain on the lens: one card 0.45 m in front of it, so the DOF turns it into out-of-focus droplets
    this.lensMat = new THREE.MeshBasicMaterial({ map: memoLens(), transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    this.lens = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.lensMat);
    this.lens.layers.set(NOINK); this.lens.frustumCulled = false; R.add(this.lens);
  }

  private rain(n: number, half: number, size: number, sp: number, a: number, op: number): Rain {
    const lx = new Float32Array(n), ly = new Float32Array(n), lz = new Float32Array(n);
    const rnd = mulberry32(4200 + n);
    for (let i = 0; i < n; i++) {
      lx[i] = (rnd() * 2 - 1) * half * 0.62;
      ly[i] = YMIN + rnd() * (YMAX - YMIN);
      lz[i] = -(0.8 + rnd() * 26);
      void a;
    }
    const g = new THREE.BufferGeometry();
    const pos = new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3);
    g.setAttribute("position", pos);
    const mat = new THREE.PointsMaterial({ map: memoRain(), size, sizeAttenuation: true, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color("#93aad0"), fog: false, toneMapped: false });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false; pts.layers.set(NOINK);
    this.root.add(pts);
    return { pts, attr: pos, lx, ly, lz, n, sp };
  }

  /** f = frame, cam = the shot camera, tramZf = the tram centre-line z at this frame. */
  update(f: number, cam: THREE.PerspectiveCamera, tramZf: number) {
    const t = f / FPS;
    const e = cam.matrixWorld.elements;
    const rx = e[0], ry = e[1], rz = e[2], ux = e[4], uy = e[5], uz = e[6];
    const fx = -e[8], fy = -e[9], fz = -e[10];
    const px = cam.position.x, py = cam.position.y, pz = cam.position.z;
    const span = YMAX - YMIN;
    const wind = 0.55 * t;
    for (const r of this.rains) {
      const a = r.attr.array as Float32Array;
      for (let i = 0; i < r.n; i++) {
        let y = r.ly[i] - r.sp * t;
        y = YMAX - (((YMAX - y) % span) + span) % span;
        const lx = r.lx[i] + wind % 6;
        const lz = r.lz[i];
        a[i * 3] = px + rx * lx + ux * y + fx * lz;
        a[i * 3 + 1] = py + ry * lx + uy * y + fy * lz;
        a[i * 3 + 2] = pz + rz * lx + uz * y + fz * lz;
      }
      r.attr.needsUpdate = true;
    }
    for (const s of this.spl) {
      const u = ((t + s.off) % s.per) / s.per;
      const k = s.sc * (0.5 + 2.6 * u);
      s.m.scale.set(k, 1, k);
      s.mat.opacity = 0.55 * Math.pow(1 - u, 2.1);
    }
    for (const g of this.glints) {
      const z = g.onTram ? tramZf + g.dz : g.dz;
      g.m.position.set(g.x, STREET.waterY + 0.014, z);
      const k = 0.55 + 0.45 * Math.sin(f * 0.31 + g.ph);
      const near = g.onTram ? sat(1 - Math.abs(g.x - 3.2) / 3.5) : 1;
      g.mat.opacity = (g.onTram ? 0.30 : 0.26) * (0.45 + 0.55 * k) * g.s * (0.35 + 0.65 * near);
      g.m.scale.set(1, 1, 0.8 + 0.5 * k);
    }
    // the lens card, sized to the frustum at 0.45 m and left slightly out of focus
    const d = 0.45, h = 2 * d * Math.tan((cam.fov * Math.PI) / 360) * 1.35, w = h * 0.5625;
    this.lens.scale.set(w, h, 1);
    this.lens.position.set(px + fx * d, py + fy * d, pz + fz * d);
    this.lens.quaternion.copy(cam.quaternion);
    this.lensMat.map!.offset.set(0.05 * Math.sin(t * 0.7), -0.0022 * f);
    this.lensMat.opacity = 0.34 + 0.10 * Math.sin(f * 0.23);
    void this.v; void clamp; void hash1;
  }
}

const M = new Map<string, THREE.Texture>();
function memoRain() { if (!M.has("r")) M.set("r", rainStreak()); return M.get("r")!; }
function memoRing() { if (!M.has("s")) M.set("s", splashRing()); return M.get("s")!; }
function memoStreak() { if (!M.has("k")) M.set("k", streak()); return M.get("k")!; }
function memoLens() { if (!M.has("l")) M.set("l", lensRain()); return M.get("l")!; }
void radial;
