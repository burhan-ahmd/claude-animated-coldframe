// city.ts — the street: wet cobbles under a flood sheet, pavements and kerbs, the buildings on both sides
// (painted flat facades with real 3D cornices, so they read richly at a grazing angle and cost almost nothing),
// gas lamps, the rails, the overhead wire, and the light that all of it throws on the water.
// One owner: this file. Everything here is deterministic (mulberry32) and Canvas2D-painted: no assets to lose.
import * as THREE from "three";
import { STREET, LAMPS, NIGHT, GLOW, FPS, tramZ, mulberry32, clamp, lerp, sat } from "./contract";
import { cobbles, flags, kerb, slates, radial, streak, waterDetail } from "./wet";
import { TONE, twoTone, untone } from "../bridge/shade";
import { NOINK } from "../bridge/ink";
import { camAt } from "./story";

const FACE = STREET.half;                 // 7.0 — the building faces
const ROAD_W = STREET.kerb * 2;           // 9.24
const Z0 = STREET.zBack, Z1 = STREET.zFront, ZL = Z1 - Z0, ZC = (Z0 + Z1) / 2;
const PAVE = 0.145;                       // pavement height

const CACHE = new Map<string, unknown>();
const memo = <T,>(k: string, f: () => T): T => { if (!CACHE.has(k)) CACHE.set(k, f()); return CACHE.get(k) as T; };
const rgb = (c: number[]) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

/** A private copy of a shared canvas texture with its own repeat (the image is shared, the UVs are not). */
function tile(t: THREE.Texture, rx: number, ry: number): THREE.Texture {
  const c = t.clone();
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(rx, ry);
  c.anisotropy = 8;
  c.needsUpdate = true;
  return c;
}

// ---------------------------------------------------------------- painted facades
const SHOPS = ["DRAPER", "TOBACCONIST", "BAKERY", "CHEMIST", "TAILOR", "COAL & IRON", "STATIONER", "GROCER", "BOOTMAKER", "NEWSAGENT"];
const PAL = [
  { a: [54, 45, 39], b: [70, 58, 48], brick: 1 },   // brown brick
  { a: [60, 41, 37], b: [76, 52, 44], brick: 1 },   // red brick
  { a: [60, 59, 55], b: [72, 70, 65], brick: 0 },   // stucco
  { a: [47, 51, 56], b: [58, 62, 68], brick: 0 },   // grey render
];

/** One building front, 320x640, painted at its final night brightness. Lit windows are the only bright thing. */
function facadeTex(wm: number, hm: number, kind: number, seed: number, shop: string): THREE.CanvasTexture {
  const W = 320, H = 640;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d") as CanvasRenderingContext2D;
  const rnd = mulberry32(seed);
  const p = PAL[kind % PAL.length];
  const mx = W / wm, my = H / hm;
  const X = (m: number) => m * mx, Y = (m: number) => H - m * my;
  c.fillStyle = rgb(p.a); c.fillRect(0, 0, W, H);

  if (p.brick) {                                   // brick courses, 0.085 m, offset every other row
    for (let y = 0; y < hm; y += 0.085) {
      const off = ((y / 0.085) | 0) % 2 ? 0.11 : 0;
      for (let x = -0.22; x < wm + 0.22; x += 0.22) {
        const k = 0.82 + rnd() * 0.36;
        c.fillStyle = `rgb(${(p.b[0] * k) | 0},${(p.b[1] * k) | 0},${(p.b[2] * k) | 0})`;
        c.fillRect(X(x + off), Y(y + 0.085), 0.215 * mx, 0.078 * my);
      }
    }
  } else {
    for (let i = 0; i < 260; i++) {                // stucco mottle
      const k = 0.86 + rnd() * 0.3, rr = 0.1 + rnd() * 0.4;
      c.fillStyle = `rgba(${(p.b[0] * k) | 0},${(p.b[1] * k) | 0},${(p.b[2] * k) | 0},0.5)`;
      c.fillRect(X(rnd() * wm), Y(rnd() * hm), rr * mx * 2, rr * my * 2);
    }
  }
  // string courses between the floors, and a raised ground-floor band
  c.fillStyle = "rgba(255,248,230,0.10)";
  for (let y = 3.5; y < hm - 1.4; y += 2.9) c.fillRect(0, Y(y) - 2, W, 3);
  c.fillStyle = "rgba(0,0,0,0.30)"; c.fillRect(0, Y(3.42), W, 3);

  // ---- ground floor: a shopfront
  const gfTop = 3.15;
  c.fillStyle = "#241a12"; c.fillRect(0, Y(gfTop), W, Y(0) - Y(gfTop));
  const bays = Math.max(2, Math.round(wm / 1.7));
  const bw = wm / bays;
  for (let i = 0; i < bays; i++) {
    const x0 = i * bw + 0.16, x1 = (i + 1) * bw - 0.16;
    const lit = rnd() < 0.42;
    const g = c.createLinearGradient(0, Y(2.6), 0, Y(0.35));
    if (lit) { g.addColorStop(0, "#e8b473"); g.addColorStop(1, "#7a4c22"); }
    else { g.addColorStop(0, "#141a26"); g.addColorStop(1, "#080a10"); }
    c.fillStyle = g; c.fillRect(X(x0), Y(2.6), (x1 - x0) * mx, (2.6 - 0.35) * my);
    if (lit) {                                      // painted goods on the shelves behind the glass
      c.fillStyle = "rgba(52,30,14,0.85)";
      for (let k = 0; k < 4; k++) c.fillRect(X(x0 + 0.18 + k * (x1 - x0 - 0.3) / 4), Y(1.5), 0.16 * mx, (0.9 + rnd() * 0.5) * my);
      c.fillStyle = "rgba(255,226,180,0.18)"; c.fillRect(X(x0), Y(2.6), (x1 - x0) * mx, 0.5 * my);
    }
    c.fillStyle = "#1a1310";                        // glazing bars
    c.fillRect(X(x0 + (x1 - x0) / 2) - 2, Y(2.6), 4, (2.6 - 0.35) * my);
    c.fillRect(X(x0), Y(1.55) - 2, (x1 - x0) * mx, 4);
    c.fillStyle = "rgba(220,235,255,0.06)";          // rain running down the glass
    for (let k = 0; k < 5; k++) c.fillRect(X(x0 + rnd() * (x1 - x0)), Y(2.6), 1.5, (1.6 + rnd()) * my);
  }
  // the shop sign
  c.fillStyle = "#2a1e14"; c.fillRect(0, Y(gfTop - 0.08), W, 0.72 * my);
  c.fillStyle = "#3a2a1a"; c.fillRect(0, Y(gfTop - 0.08), W, 4);
  c.fillStyle = rnd() < 0.3 ? "#c8a860" : "#b79552";
  c.font = `bold ${Math.min(0.42 * my, 34)}px Georgia, serif`;
  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText(shop, W / 2, Y(gfTop - 0.44));
  // door
  c.fillStyle = "#161010"; c.fillRect(X(wm * 0.5 - 0.45), Y(2.3), 0.9 * mx, 2.3 * my);
  c.fillStyle = "rgba(255,210,150,0.10)"; c.fillRect(X(wm * 0.5 - 0.45), Y(2.3), 0.9 * mx, 0.5 * my);

  // ---- upper windows
  for (let fy = 3.9; fy < hm - 1.6; fy += 2.9) {
    const n = Math.max(1, Math.round(wm / 1.75));
    const step = wm / n;
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * step, w = 0.95, h = 1.5;
      const lit = rnd() < 0.22;
      const x0 = X(cx - w / 2), x1 = X(cx + w / 2);
      c.fillStyle = "rgba(0,0,0,0.45)"; c.fillRect(x0 - 3, Y(fy + h) - 3, (x1 - x0) + 6, h * my + 6);  // reveal
      if (lit) {
        const g = c.createLinearGradient(0, Y(fy + h), 0, Y(fy));
        g.addColorStop(0, "#f0c184"); g.addColorStop(0.55, "#c99257"); g.addColorStop(1, "#7d5228");
        c.fillStyle = g; c.fillRect(x0, Y(fy + h), x1 - x0, h * my);
        if (rnd() < 0.45) {                            // somebody is still up
          c.fillStyle = "rgba(44,26,14,0.9)";
          const sx = x0 + (x1 - x0) * (0.3 + rnd() * 0.4);
          c.beginPath(); c.ellipse(sx, Y(fy + 1.05), 0.11 * mx, 0.13 * my, 0, 0, 7); c.fill();
          c.fillRect(sx - 0.14 * mx, Y(fy + 0.95), 0.28 * mx, 0.95 * my);
        }
      } else {
        const g = c.createLinearGradient(0, Y(fy + h), 0, Y(fy));
        g.addColorStop(0, "#1b2634"); g.addColorStop(0.5, "#0e1420"); g.addColorStop(1, "#090c14");
        c.fillStyle = g; c.fillRect(x0, Y(fy + h), x1 - x0, h * my);
        c.fillStyle = "rgba(140,170,205,0.10)"; c.fillRect(x0, Y(fy + h), x1 - x0, 0.5 * my);
      }
      c.fillStyle = "#241c14";                         // frame + glazing bars
      c.fillRect(x0 - 2, Y(fy + h) - 2, (x1 - x0) + 4, 3);
      c.fillRect(x0 - 2, Y(fy) - 2, (x1 - x0) + 4, 3);
      c.fillRect(x0 - 2, Y(fy + h) - 2, 3, h * my + 4);
      c.fillRect(x1 - 1, Y(fy + h) - 2, 3, h * my + 4);
      c.fillRect(X(cx) - 1.5, Y(fy + h), 3, h * my);
      c.fillRect(x0, Y(fy + h / 2) - 1.5, x1 - x0, 3);
      c.fillStyle = "rgba(255,246,226,0.12)";           // sill
      c.fillRect(x0 - 4, Y(fy) + 3, (x1 - x0) + 8, 3);
      c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(x0 - 4, Y(fy) + 6, (x1 - x0) + 8, 2);
    }
  }
  // soot from the top, damp rising from the pavement, and the wash of the nearest gas lamp from below
  const gs = c.createLinearGradient(0, 0, 0, H);
  gs.addColorStop(0, "rgba(8,10,16,0.55)"); gs.addColorStop(0.35, "rgba(8,10,16,0.12)");
  gs.addColorStop(0.8, "rgba(10,14,22,0.22)"); gs.addColorStop(1, "rgba(16,20,30,0.42)");
  c.fillStyle = gs; c.fillRect(0, 0, W, H);
  const lw = c.createRadialGradient(W * 0.5, Y(0), 0, W * 0.5, Y(0), H * 0.42);
  lw.addColorStop(0, "rgba(255,196,120,0.16)"); lw.addColorStop(1, "rgba(255,196,120,0)");
  c.fillStyle = lw; c.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------- the world
export class World {
  root = new THREE.Group();
  private hemi = new THREE.HemisphereLight(NIGHT.hemiSky, NIGHT.hemiGround, NIGHT.hemiI);
  private moon = new THREE.DirectionalLight(NIGHT.sunCol, NIGHT.sunI);
  private skyMat: THREE.ShaderMaterial;
  private sky: THREE.Mesh;
  private fog = new THREE.Fog(NIGHT.fog, NIGHT.fogNear, NIGHT.fogFar);
  private waterMap: THREE.Texture;
  private halos: THREE.Sprite[] = [];
  private v = new THREE.Vector3();

  constructor() {
    const R = this.root, t = memo("t", () => cobbles()), fl = memo("f", () => flags()), kb = memo("k", () => kerb()), wd = memo("wd", () => waterDetail());

    // ---- sky: three stops, written as tone-map-inverted linear values so the on-screen colour is the target
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { cT: { value: new THREE.Color() }, cM: { value: new THREE.Color() }, cH: { value: new THREE.Color() } },
      vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 cT, cM, cH; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(cH, cM, smoothstep(0.0, 0.14, el));
          c = mix(c, cT, smoothstep(0.14, 0.62, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 20), this.skyMat);
    this.sky.frustumCulled = false; this.sky.renderOrder = -1; this.sky.layers.set(NOINK); R.add(this.sky);

    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.moon, this.moon.target);

    // ---- road, pavements, kerbs, rails
    const road: THREE.Material[] = [twoTone(new THREE.MeshPhongMaterial({
      map: tile(t, ROAD_W / 2.4, ZL / 2.4), color: "#b9bec8", specular: "#93a8c4", shininess: 30,
    }), 0.55)];
    const rg = new THREE.PlaneGeometry(ROAD_W, ZL); rg.rotateX(-Math.PI / 2);
    const rm = new THREE.Mesh(rg, road[0]); rm.position.set(0, 0, ZC); rm.receiveShadow = true; R.add(rm);

    const paveMat = twoTone(new THREE.MeshLambertMaterial({ map: tile(fl, 2.38 / 2.6, ZL / 2.6), color: "#c2c6cc" }), 0.5);
    const kerbMat = twoTone(new THREE.MeshLambertMaterial({ map: tile(kb, ZL / 1.2, 1), color: "#c6cad0" }), 0.5);
    const stone = twoTone(new THREE.MeshLambertMaterial({ color: "#4a4e56" }), 0.5);
    for (const s of [-1, 1]) {
      const pg = new THREE.PlaneGeometry(2.38, ZL); pg.rotateX(-Math.PI / 2);
      const pm = new THREE.Mesh(pg, paveMat); pm.position.set(s * (STREET.kerb + 1.19), PAVE, ZC); pm.receiveShadow = true; R.add(pm);
      const kg = new THREE.BoxGeometry(0.10, PAVE, ZL);
      const km = new THREE.Mesh(kg, kerbMat); km.position.set(s * (STREET.kerb + 0.05), PAVE / 2, ZC); km.receiveShadow = true; R.add(km);
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.38, PAVE, ZL), stone);
      body.position.set(s * (STREET.kerb + 1.19), PAVE / 2, ZC); R.add(body);
    }
    // rails, standing proud of the flood (STREET.railTop)
    const railMat = twoTone(new THREE.MeshPhongMaterial({ color: "#8b9098", specular: "#dfe9f7", shininess: 120 }), 0.5);
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.085, 0.030, ZL);
      const m = new THREE.Mesh(g, railMat); m.position.set(s * STREET.railX, STREET.railTop, ZC); R.add(m);
      const g2 = new THREE.BoxGeometry(0.15, 0.012, ZL);
      const m2 = new THREE.Mesh(g2, twoTone(new THREE.MeshLambertMaterial({ color: "#2a3038" }), 0.5));
      m2.position.set(s * STREET.railX, STREET.railTop - 0.028, ZC); R.add(m2);
    }

    // ---- the flood sheet: a Phong film over the cobbles, drifting
    this.waterMap = tile(wd, ROAD_W / 1.6, ZL / 1.6);
    const wm = twoTone(new THREE.MeshPhongMaterial({
      map: this.waterMap, color: "#3d5a7d", specular: "#cfe2ff", shininess: 160,
      transparent: true, opacity: 0.60, depthWrite: false,
    }), 0.7);
    const wg = new THREE.PlaneGeometry(ROAD_W, ZL); wg.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(wg, wm); water.position.set(0, STREET.waterY, ZC); water.renderOrder = 1; R.add(water);

    // ---- buildings
    this.buildings(R);

    // ---- gas lamps: a pole, a lantern, a halo, a pool on the water and a reflection streak
    const lampGlass = new THREE.MeshBasicMaterial({ color: new THREE.Color(GLOW.lampWarm).multiplyScalar(GLOW.lampGlass), toneMapped: false });
    const brass = twoTone(new THREE.MeshPhongMaterial({ color: "#3a3630", specular: "#9a8a60", shininess: 40 }), 0.5);
    const poolMat = new THREE.MeshBasicMaterial({ map: memo("halo", () => radial(101, 2.1, 0.9)), color: new THREE.Color(GLOW.lampWarm), transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: true });
    const streakMat = new THREE.MeshBasicMaterial({ map: memo("str", () => streak()), color: new THREE.Color(GLOW.glintCol), transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: true });
    for (const L of LAMPS) {
      const g = new THREE.Group(); g.position.set(L.x, PAVE, L.z); R.add(g);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, L.s, 10), brass); pole.position.y = L.s / 2; pole.castShadow = true; g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.05), brass); arm.position.set(-Math.sign(L.x) * 0.17, L.s - 0.02, 0); g.add(arm);
      const lx = -Math.sign(L.x) * 0.34;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.30, 0.22), lampGlass); box.position.set(lx, L.s - 0.18, 0); g.add(box);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.16, 4), brass); cap.position.set(lx, L.s + 0.04, 0); cap.rotation.y = Math.PI / 4; g.add(cap);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: poolMat.map, color: new THREE.Color(GLOW.lampWarm), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      halo.scale.setScalar(2.2); halo.position.set(lx, L.s - 0.18, 0); halo.layers.set(NOINK); g.add(halo); this.halos.push(halo);
      const pg = new THREE.PlaneGeometry(3.6, 3.6); pg.rotateX(-Math.PI / 2);
      const pool = new THREE.Mesh(pg, poolMat); pool.position.set(L.x + lx * 0.7, STREET.waterY + 0.004 - PAVE, L.z); pool.renderOrder = 2; g.add(pool);
      const sg = new THREE.PlaneGeometry(0.55, 2.9); sg.rotateX(-Math.PI / 2);
      const sm = new THREE.Mesh(sg, streakMat); sm.position.set(L.x + lx * 0.6, STREET.waterY + 0.006 - PAVE, L.z - 0.6); sm.renderOrder = 3; g.add(sm);
    }

    // ---- the overhead wire and its span wires (thin: no ink, or they double-line)
    const wire = new THREE.MeshBasicMaterial({ color: "#0c0f14" });
    const along = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, ZL), wire);
    along.position.set(0, 5.35, ZC); along.layers.set(NOINK); R.add(along);
    for (let z = Z0 + 8; z < Z1; z += 22) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(FACE * 2, 0.026, 0.026), wire);
      s.position.set(0, 5.35, z); s.layers.set(NOINK); R.add(s);
    }

    // ---- a few shop spills on the pavement (warm additive, so the flags are not dead)
    for (const [x, z, s] of [[5.2, -1.0, 2.4], [5.2, -13.0, 2.0], [-5.2, -7.0, 2.2], [-5.2, 5.0, 1.8]] as Array<[number, number, number]>) {
      const g = new THREE.PlaneGeometry(s * 1.6, s); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: poolMat.map, color: new THREE.Color(GLOW.lampWarm), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      m.position.set(x, PAVE + 0.004, z); m.renderOrder = 2; R.add(m);
    }
  }

  /** A row of buildings down each side: painted facade, masonry mass, cornice, slate roof, chimney, drainpipe. */
  private buildings(R: THREE.Group) {
    const brickM = twoTone(new THREE.MeshLambertMaterial({ map: tile(memo("br", () => cobbles(77)), 3, 3), color: "#8a7c70" }), 0.5);
    const massM = twoTone(new THREE.MeshLambertMaterial({ color: "#2e3138" }), 0.5);
    const roofM = twoTone(new THREE.MeshLambertMaterial({ map: tile(memo("sl", () => slates()), 6, 2), color: "#aab6c6" }), 0.5);
    for (const side of [-1, 1]) {
      const rnd = mulberry32(side > 0 ? 9101 : 9102);
      let z = Z0 + 4;
      let i = 0;
      while (z < 15) {
        const w = 5.5 + rnd() * 4.6, h = 9 + rnd() * 6.5;
        const kind = (rnd() * 4) | 0, shop = SHOPS[(rnd() * SHOPS.length) | 0];
        const cx = z + w / 2;
        const ft = memo(`fac${side}_${i}`, () => facadeTex(w, h, kind, (side > 0 ? 3000 : 5000) + i * 17, shop));
        const fg = new THREE.PlaneGeometry(w, h);
        const fm = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map: ft, fog: true }));
        fm.position.set(side * (FACE - 0.012), h / 2, cx);
        fm.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        R.add(fm);
        const mass = new THREE.Mesh(new THREE.BoxGeometry(6, h, w), massM);
        mass.position.set(side * (FACE + 3), h / 2, cx); R.add(mass);
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: ft, fog: true }));
        wall.position.set(side * (FACE + 0.02), h / 2, cx); wall.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; R.add(wall);
        const cg = new THREE.BoxGeometry(0.30, 0.22, w + 0.12);
        const cm = new THREE.Mesh(cg, brickM); cm.position.set(side * (FACE - 0.15), h - 0.11, cx); R.add(cm);
        const rg = new THREE.BoxGeometry(5.4, 0.55, w + 0.34);
        const rf = new THREE.Mesh(rg, roofM); rf.position.set(side * (FACE + 2.7), h + 0.27, cx); R.add(rf);
        const nch = 1 + ((rnd() * 2) | 0);
        for (let k = 0; k < nch; k++) {
          const ch = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1 + rnd(), 0.7), massM);
          ch.position.set(side * (FACE + 1.2 + rnd() * 2.4), h + 0.55 + 0.55, z + 0.8 + rnd() * (w - 1.6)); R.add(ch);
        }
        const dp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, h - 0.4, 8), massM);
        dp.position.set(side * (FACE - 0.10), (h - 0.4) / 2, z + 0.22); R.add(dp);
        z += w + 0.16;
        i++;
      }
    }
  }

  update(_id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3 {
    const c = camAt(f);
    cam.position.copy(c.pos); cam.up.set(0, 1, 0); cam.lookAt(c.look); cam.rotateZ((c.roll * Math.PI) / 180);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 700; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);

    // ---- light rig: a camera-relative moon, frozen in place per shot, plus the world two-tone uniforms
    const fwd = cam.getWorldDirection(this.v.clone());
    const az = (NIGHT.az * Math.PI) / 180, el = (NIGHT.el * Math.PI) / 180;
    const hx = fwd.x * Math.cos(az) - fwd.z * Math.sin(az), hz = fwd.z * Math.cos(az) + fwd.x * Math.sin(az);
    const dir = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    const dist = cam.position.distanceTo(c.look);
    const Rr = clamp(dist * 1.2 + 8, 14, 70);
    this.moon.position.copy(c.look).addScaledVector(dir, 90);
    this.moon.target.position.copy(c.look);
    const sc = this.moon.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 5; sc.far = 190; sc.updateProjectionMatrix();
    this.moon.shadow.bias = NIGHT.bias; this.moon.shadow.normalBias = NIGHT.normalBias;
    TONE.uLitCol.value.set(NIGHT.lit[0], NIGHT.lit[1], NIGHT.lit[2]);
    TONE.uShadeCol.value.set(NIGHT.shade[0], NIGHT.shade[1], NIGHT.shade[2]);
    TONE.uShadeLift.value.set(NIGHT.lift[0], NIGHT.lift[1], NIGHT.lift[2]);
    TONE.uLambert.value = NIGHT.lambert; TONE.uSideK.value = NIGHT.sideK; TONE.uTerm.value = NIGHT.term;
    TONE.uBounce.value.set(NIGHT.bounce[0], NIGHT.bounce[1], NIGHT.bounce[2]); TONE.uSat.value = NIGHT.sat;

    // ---- sky and fog
    const su = this.skyMat.uniforms;
    untone(NIGHT.top, su.cT.value as THREE.Color);
    untone(NIGHT.haze, su.cM.value as THREE.Color);
    untone(NIGHT.hor, su.cH.value as THREE.Color);
    this.sky.position.copy(cam.position);
    untone(NIGHT.fog, this.fog.color); this.fog.near = NIGHT.fogNear; this.fog.far = NIGHT.fogFar;
    scene.fog = this.fog; scene.background = null;

    // ---- the flood drifts, and the lamp halos breathe very slightly (a gas jet, not a strobe)
    const t = f / FPS;
    this.waterMap.offset.set(0.03 * Math.sin(t * 0.21), -0.014 * t);
    for (let i = 0; i < this.halos.length; i++) {
      const k = 1 + 0.05 * Math.sin(f * 0.9 + i * 2.1) + 0.03 * Math.sin(f * 2.3 + i);
      this.halos[i].scale.setScalar(2.2 * k);
    }
    return c.look.clone();
  }
}
