// "The Man Who Rode to Victory" (Fred Lorz, 1904): the place.
// The finish straight of the St. Louis Olympic marathon as one three.js scene: a dirt road across the prairie with
// a mile post, the rope barrier, the judges' table, the two-post finish tape, a four-tier wooden grandstand flying
// a painted banner, the farm town and its hills on the horizon, and the steam-era tourer the story rides in (built
// from primitives: the Kenney kit has no vehicles) in two states -- the drivable one of shots 1-8 and the rusting
// wreck Fred walks past in the 1905 coda. update(id, f, camera, scene) poses everything for shot `id` at frame f (a
// pure function of id + f) and returns the lens focus the composition's DOF needs.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { Batch, Strand, boxGeo, quad, V, lam, prop, house, Kit } from "../bridge/build";
import { ctex, beam, grassHD, cloudHD } from "../bridge/paint";
import { LIGHTS, LOOK, LightPreset } from "../bridge/lights";
import { TONE, CHAR, untone } from "../bridge/shade";
import { NOINK } from "../bridge/ink";
import { Pool, Actor, Fx, stage } from "./cast";
import {
  FPS, SHOTS, CAR_Z, TAPE_X, TAPE_H, GRAND, carX, carSpeed, engineHz, tapeBroken, tapeEnd, camAt, focusAt, ShotDef,
} from "./story";

// ---------------- assets (the same CC0 Kenney props the bridge study commits) ----------------
const KENNEY = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree-high-round", "tree_cone", "tree",
  "plant_bushLarge", "plant_bushDetailed", "plant_bush", "hedge", "lantern", "stall-bench", "cart"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map((n) => loader.loadAsync(staticFile(`bridge/kenney/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };

// ---------------- sky, sun disc and halo ----------------
/** sun disc (solid, soft rim) and the flat golden halo (lighting.md 6 / depth.md 6.4: r50 13-26 % of the frame width) */
const discTex = () => ctex("fl_sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("fl_sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});

// ---------------- painted set dressing ----------------
/** the dirt road: warm dust, wheel ruts along u (the road runs along x), scuffs and small stones */
const dirtTex = () => ctex("fl_dirt", 1024, 1024, (g, r) => {
  g.fillStyle = "#c9a877"; g.fillRect(0, 0, 1024, 1024);
  for (let k = 0; k < 900; k++) {
    const x = r() * 1024, y = r() * 1024, rad = 6 + r() * 34;
    g.fillStyle = r() < 0.5 ? `rgba(190,150,104,${0.05 + 0.1 * r()})` : `rgba(226,199,158,${0.05 + 0.1 * r()})`;
    g.beginPath(); g.ellipse(x, y, rad, rad * (0.4 + 0.3 * r()), r() * 3, 0, 7); g.fill();
  }
  for (const y of [150, 330, 690, 870]) { // ruts: darker where the wheels run (v = across the road)
    g.strokeStyle = "rgba(150,113,72,0.3)"; g.lineWidth = 26 + 22 * r();
    g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + 16 * Math.sin(x * 0.01 + y)); g.stroke();
    g.strokeStyle = "rgba(238,214,176,0.22)"; g.lineWidth = 10;
    g.beginPath(); g.moveTo(0, y + 22); for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + 22 + 16 * Math.sin(x * 0.01 + y)); g.stroke();
  }
  for (let k = 0; k < 260; k++) { // stones
    const x = r() * 1024, y = r() * 1024, rad = 2 + r() * 5;
    g.fillStyle = r() < 0.5 ? "rgba(120,96,70,0.5)" : "rgba(240,226,204,0.45)";
    g.beginPath(); g.ellipse(x, y, rad, rad * 0.7, r() * 3, 0, 7); g.fill();
  }
});

/** the mile post plate: a white plate, a big "9" and MILES under it (a sorry joke about how far he still had to go) */
const mileTex = () => ctex("fl_mile9", 200, 150, (g) => {
  g.fillStyle = "#efe6d2"; g.fillRect(0, 0, 200, 150);
  g.strokeStyle = "#2a2028"; g.lineWidth = 7; g.strokeRect(8, 8, 184, 134);
  g.fillStyle = "#241726"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "bold 84px Georgia, serif"; g.fillText("9", 100, 62);
  g.font = "bold 30px Georgia, serif"; g.fillText("MILES", 100, 118);
});

/** the grandstand banner: the day banner announces the Games, the golden one the 1905 Boston re-run (the coda) */
const bannerTex = (key: string, text: string, field: string, ink: string) => ctex(key, 2048, 128, (g) => {
  g.fillStyle = field; g.fillRect(0, 0, 2048, 128);
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, "rgba(255,255,255,0.14)"); gr.addColorStop(0.55, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(0,0,0,0.18)");
  g.fillStyle = gr; g.fillRect(0, 0, 2048, 128);
  g.strokeStyle = ink; g.lineWidth = 6; g.globalAlpha = 0.55; g.strokeRect(16, 12, 2016, 104); g.globalAlpha = 1;
  g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "bold 78px Georgia, serif"; g.fillText(text, 1024, 68);
});

// ---------------- cars (primitives: the kit has no vehicles) ----------------
/** rusted bodywork: a faded panel with flaking paint and run streaks */
const rustTex = () => ctex("fl_rust", 256, 256, (g, r) => {
  g.fillStyle = "#6d5b4a"; g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 120; k++) {
    const x = r() * 256, y = r() * 256, rad = 4 + r() * 22;
    g.fillStyle = r() < 0.45 ? `rgba(125,75,44,${0.3 + 0.4 * r()})` : r() < 0.8 ? `rgba(150,96,52,${0.25 + 0.35 * r()})` : `rgba(58,50,42,${0.3 + 0.3 * r()})`;
    g.beginPath(); g.ellipse(x, y, rad, rad * (0.5 + 0.5 * r()), r() * 3, 0, 7); g.fill();
  }
  for (let k = 0; k < 24; k++) { // streaks running down
    const x = r() * 256; g.strokeStyle = `rgba(96,58,36,${0.15 + 0.2 * r()})`; g.lineWidth = 2 + r() * 7;
    g.beginPath(); g.moveTo(x, r() * 120); g.lineTo(x + 6 * (r() - 0.5), 150 + r() * 106); g.stroke();
  }
});

type Car = { g: THREE.Group; body: THREE.Group; wheels: THREE.Group[] };
/** a 1904 open tourer on the ground, facing +x: local x -1.5 (tail) .. 2.3 (radiator), wheels at x +-1.2ish */
const carGroup = (rusted: boolean): Car => {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const s = rusted ? "R" : "";
  const M = {
    body: lam("fl_carBody" + s, () => (rusted ? { map: rustTex() } : { color: "#8d3b2f" })),
    dark: lam("fl_carDark" + s, () => ({ color: rusted ? "#463f38" : "#282425" })),
    brass: lam("fl_carBrass" + s, () => ({ color: rusted ? "#8b7a58" : "#c9a24e" })),
    hide: lam("fl_carHide" + s, () => ({ color: rusted ? "#5c4e40" : "#4b3428" })),
    tyre: lam("fl_carTyre" + s, () => ({ color: rusted ? "#4b463f" : "#2b2723" })),
    wood: lam("fl_carWood" + s, () => ({ map: beam() })),
    glass: lam("fl_carGlass" + s, () => ({ color: rusted ? "#8f8574" : "#ffeec4" })),
  };
  const b = new Batch();
  const bx = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, m: THREE.Material, tile = 0) =>
    b.add(boxGeo(V(x0, y0, z0), V(x1, y1, z1), tile), m);
  /** a round bar from a to b */
  const bar = (m: THREE.Material, ax: number, ay: number, az: number, bx2: number, by: number, bz: number, r: number) => {
    const a = V(ax, ay, az), c = V(bx2, by, bz), len = a.distanceTo(c);
    b.add(new THREE.CylinderGeometry(r, r, len, 10).translate(0, len / 2, 0), m,
      new THREE.Matrix4().compose(a, new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), c.clone().sub(a).normalize()), V(1, 1, 1)));
  };
  const rt = rusted ? 0.7 : 0; // the rusted panels are textured, so boxGeo tiles
  // chassis, tub (floor + both side panels + dash + rear panel, so the riders sit inside it), running boards
  bx(-1.5, 2.0, 0.4, 0.5, -0.5, 0.5, M.dark, rt);
  bx(-1.46, 0.6, 0.5, 0.54, -0.64, 0.64, M.dark, rt);
  for (const sz of [-1, 1]) {
    bx(-1.46, 0.62, 0.5, 1.0, sz < 0 ? -0.66 : 0.58, sz < 0 ? -0.58 : 0.66, M.body, rt);
    bx(-1.02, 0.72, 0.44, 0.5, sz < 0 ? -0.9 : 0.66, sz < 0 ? -0.66 : 0.9, M.dark, rt); // running board
  }
  bx(-1.46, -1.38, 0.5, 1.3, -0.62, 0.62, M.body, rt);                                   // rear panel
  bx(-1.6, -1.46, 0.62, 0.9, -0.56, 0.56, M.dark, rt);                                   // tail deck
  bx(-1.5, -1.05, 1.06, 1.22, -0.5, 0.5, M.dark, rt);                                    // folded canopy
  bx(0.56, 0.66, 0.5, 1.44, -0.62, 0.62, M.wood, rt);                                    // scuttle + windscreen frame
  bx(0.62, 0.68, 1.02, 1.4, -0.1, 0.5, M.glass, rt);                                     // windscreen glass
  bx(0.62, 0.68, 1.02, 1.4, -0.5, -0.1, M.glass, rt);
  // bench (driver's side -z, Fred +z) and its backrest
  bx(-0.42, 0.52, 0.72, 0.8, -0.56, 0.56, M.hide, rt);
  bx(-0.5, -0.42, 0.8, 1.42, -0.56, 0.56, M.hide, rt);
  bx(-0.06, 0.02, 0.8, 1.36, -0.54, 0.54, M.dark, rt);                                   // bench division
  // bonnet, radiator, lamps, crank
  bx(0.72, 1.94, 0.54, 0.96, -0.46, 0.46, M.body, rt);
  bx(0.72, 1.5, 0.96, 1.0, -0.4, 0.4, M.body, rt);
  bx(1.94, 2.06, 0.5, 1.12, -0.44, 0.44, M.brass, rt);
  bx(1.96, 2.05, 0.54, 1.06, -0.32, 0.32, M.dark, rt);
  for (const sz of [-1, 1]) {
    b.add(new THREE.SphereGeometry(0.11, 14, 10).translate(0, 0, 0), M.brass, new THREE.Matrix4().makeTranslation(2.14, 1.02, sz * 0.42));
    b.add(new THREE.SphereGeometry(0.075, 12, 8), M.glass, new THREE.Matrix4().makeTranslation(2.2, 1.02, sz * 0.42));
    bar(M.brass, 1.55, 0.62, sz * 0.5, 2.0, 1.4, sz * 0.5, 0.022);                        // steering column (both sides: only the driver's shows)
    bar(M.dark, 1.5, 1.42, sz * 0.5, 1.3, 1.44, sz * 0.5, 0.02);
  }
  bar(M.dark, -1.62, 0.46, 0.56, 0.5, 0.46, 0.56, 0.055);                                // exhaust
  bar(M.brass, 2.06, 0.62, 0, 2.3, 0.62, 0, 0.03);                                       // crank
  b.build(body);
  for (const o of body.children) { o.castShadow = true; o.receiveShadow = true; }
  // wheels: painted-wood spokes (4 crossed bars = 8 spokes), brass hub, rubber tyre (outer r 0.42 = the axle height)
  const wheels: THREE.Group[] = [];
  for (const [wx, wz] of [[1.35, 0.72], [1.35, -0.72], [-1.0, 0.72], [-1.0, -0.72]] as const) {
    if (rusted && wx > 0 && wz > 0) continue; // long gone, and the body has settled on that corner
    const w = new THREE.Group();
    w.position.set(wx, 0.42, wz);
    w.add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.12, 10, 22), M.tyre));
    w.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 12).rotateX(Math.PI / 2), M.brass));
    for (let k = 0; k < 4; k++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.055, 0.055), M.wood);
      sp.rotation.z = (k * Math.PI) / 4;
      w.add(sp);
    }
    w.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    g.add(w); wheels.push(w);
  }
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  if (rusted) { body.rotation.x = 0.03; body.rotation.z = 0.02; body.position.y = -0.07; }
  return { g, body, wheels };
};

/** horizontal quad facing up at height y covering x0..x1, z0..z1 (z0 < z1) */
const quadUp = (x0: number, x1: number, z0: number, z1: number, u: number, v: number, y: number) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(6).fill([0, 1, 0]).flat(), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
};

type Mats = Record<string, THREE.Material>;

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#b8d0ec", 25, 300);
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private tape: Strand[] = [];
  private car: Car; private carR: Car;
  private banner: THREE.Mesh; private bannerMaps: Record<"day" | "golden", THREE.Texture>;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root, M: Mats = {};
    // ---- sky + light ----
    // sky: 5 colour stops by elevation (textures.md 5.2 #5 + depth.md 2/6.5), written as tone-map-inverted linear values
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    // ---- ground, road, mile post (static batch) ----
    const b = new Batch();
    M.grass = lam("fl_grass", () => ({ map: grassHD() }));
    M.dirt = lam("fl_dirt", () => ({ map: dirtTex() }));
    M.wood = lam("fl_wood", () => ({ map: beam() }));
    M.plank = lam("fl_plank", () => ({ color: "#9a7a54" }));
    M.frame = lam("fl_frame", () => ({ color: "#8a6a44" }));
    M.cloth = lam("fl_cloth", () => ({ color: "#33513f" }));
    M.white = lam("fl_white", () => ({ color: "#efe6d2" }));
    M.rope = lam("fl_rope", () => ({ color: "#c9b48a" }));
    b.add(quadUp(-700, 700, -260, 260, 175, 65, 0), M.grass);
    b.add(quadUp(-700, 700, -4.2, 4.2, 250, 1.5, 0.012), M.dirt);
    // mile post, yawed to face the arriving car (and the shots 2-3 lenses)
    const mm = new THREE.Matrix4().makeRotationY(0.7).setPosition(-40, 0, 1.7);
    b.add(boxGeo(V(-0.07, 0, -0.07), V(0.07, 1.2, 0.07), 0), M.wood, mm);
    b.add(boxGeo(V(-0.09, 1.28, -0.09), V(0.09, 1.32, 0.09), 0), M.wood, mm);
    b.add(quad(V(-0.3, 0.7, 0.09), V(0.3, 0.7, 0.09), V(0.3, 1.15, 0.09), V(-0.3, 1.15, 0.09), 1, 1, 0, 0),
      lam("fl_mile", () => ({ map: mileTex(), side: THREE.DoubleSide })), mm);
    // the grandstand: a solid stepped bank of four tiers, a back wall and a roof on four posts
    for (let k = 0; k < GRAND.tiers; k++) {
      const zf = GRAND.z0 - GRAND.dz * k, y = GRAND.y0 + GRAND.dy * k;
      b.add(boxGeo(V(GRAND.x0, 0, zf - GRAND.dz), V(GRAND.x1, y, zf), 2), M.cloth);
      b.add(boxGeo(V(GRAND.x0 - 0.1, y, zf - 0.3), V(GRAND.x1 + 0.1, y + 0.07, zf), 0), M.plank); // seat plank on the front of each tread
    }
    b.add(boxGeo(V(GRAND.x0 - 0.3, 0, GRAND.z0 - GRAND.dz * GRAND.tiers - 0.5), V(GRAND.x1 + 0.3, 3.4, GRAND.z0 - GRAND.dz * GRAND.tiers), 2), M.frame);
    b.add(boxGeo(V(GRAND.x0 - 0.6, GRAND.roofY, GRAND.z0 - GRAND.dz * GRAND.tiers - 0.6), V(GRAND.x1 + 0.6, GRAND.roofY + 0.26, GRAND.z0 + 0.8), 2), M.frame);
    for (const px of [97.6, 104.4, 117.6, 124.4]) b.add(boxGeo(V(px - 0.11, 0, -13.0), V(px + 0.11, GRAND.roofY, -12.78), 0), M.frame);
    // banner poles + the banner cloth (its map is swapped per light in update())
    for (const px of [101, 121]) {
      b.add(new THREE.CylinderGeometry(0.055, 0.07, 3.6, 10).translate(0, 1.8, 0), M.wood, new THREE.Matrix4().makeTranslation(px, 0, -13.1));
      b.add(new THREE.SphereGeometry(0.09, 12, 8), lam("fl_gold", () => ({ color: "#c9a24e" })), new THREE.Matrix4().makeTranslation(px, 3.66, -13.1));
    }
    this.bannerMaps = {
      day: bannerTex("fl_banner_day", "OLYMPIC GAMES  \u2022  ST. LOUIS 1904", "#2b3f6b", "#efe4c4"),
      golden: bannerTex("fl_banner_gold", "BOSTON MARATHON  \u2022  1905", "#6b2f2b", "#f0dfba"),
    };
    this.banner = new THREE.Mesh(new THREE.PlaneGeometry(20, 1.2, 24, 3), new THREE.MeshBasicMaterial({ map: this.bannerMaps.day, side: THREE.DoubleSide, fog: true }));
    { // let the cloth sag and fold a little between the poles
      const p = this.banner.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const u = (p.getX(i) + 10) / 20;
        p.setY(i, p.getY(i) - 0.2 * Math.sin(Math.PI * u));
        p.setZ(i, 0.06 * Math.sin(Math.PI * u * 7) * Math.sin(Math.PI * u));
      }
      p.needsUpdate = true;
    }
    this.banner.position.set(111, 2.7, -13.05);
    this.banner.layers.set(NOINK);
    R.add(this.banner);
    // rope barrier in front of the grandstand, and the fences along the near verge (with the gaps the lenses sit in)
    for (let x = 96; x <= 126; x += 3) b.add(boxGeo(V(x - 0.05, 0, -6.85), V(x + 0.05, 0.9, -6.75), 0), M.wood);
    const ropeMat = M.rope as THREE.MeshLambertMaterial;
    const rope = new Strand(24, 0.05, 0.05, ropeMat, 1, false);
    rope.set(Array.from({ length: 24 }, (_, i) => { const u = i / 23; return V(96 + 30 * u, 0.85 - 0.07 * Math.sin(Math.PI * u), -6.8); }));
    R.add(rope.mesh);
    for (const [fx0, fx1] of [[-70, -52], [-12, 50], [78, 94]] as const) {
      for (let x = fx0; x <= fx1; x += 2.4) b.add(boxGeo(V(x - 0.06, 0, 5.54), V(x + 0.06, 1.1, 5.66), 0), M.wood);
      b.add(boxGeo(V(fx0 - 0.1, 0.5, 5.55), V(fx1 + 0.1, 0.6, 5.65), 0), M.plank);
      b.add(boxGeo(V(fx0 - 0.1, 0.94, 5.55), V(fx1 + 0.1, 1.04, 5.65), 0), M.plank);
    }
    // the judges' table (the verdict of shot 8) and its papers
    b.add(boxGeo(V(101.9, 0.74, -5.35), V(106.1, 0.82, -4.55), 0), M.wood);
    b.add(boxGeo(V(102.1, 0.2, -5.3), V(105.9, 0.74, -4.6), 0), M.cloth);
    for (const [lx, lz] of [[102.3, -4.75], [105.7, -4.75], [102.3, -5.15], [105.7, -5.15]] as const) b.add(boxGeo(V(lx - 0.07, 0, lz - 0.07), V(lx + 0.07, 0.2, lz + 0.07), 0), M.wood);
    b.add(boxGeo(V(102.7, 0.82, -5.15), V(103.4, 0.83, -4.85), 0), M.white);
    b.add(boxGeo(V(103.7, 0.82, -5.2), V(104.3, 0.83, -4.9), 0), M.white);
    b.add(boxGeo(V(104.9, 0.82, -5.05), V(105.2, 0.9, -4.9), 0), M.wood);
    // the two finish-tape posts (the tape itself is rebuilt every frame)
    for (const sz of [-1, 1]) {
      b.add(boxGeo(V(TAPE_X - 0.055, 0, sz * 2.9 - 0.055), V(TAPE_X + 0.055, TAPE_H + 0.1, sz * 2.9 + 0.055), 0), M.wood);
      b.add(boxGeo(V(TAPE_X - 0.1, TAPE_H + 0.1, sz * 2.9 - 0.1), V(TAPE_X + 0.1, TAPE_H + 0.18, sz * 2.9 + 0.1), 0), M.plank);
    }
    // the town on the far side of the prairie (fronts toward +x) and brick blocks behind the grandstand
    const r = (() => { let s = 11; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
    for (let i = 0; i < 8; i++) {
      const w = 7 + (i % 2) * 2, h = [7, 8.4, 9.8][i % 3];
      house(b, -95 - i * 6.5, -30 + i * 8.5 + r() * 2, Math.PI / 2, w, 8, h, i % 8, 0);
    }
    for (let i = 0; i < 7; i++) {
      const w = 7 + (i % 2) * 2, h = [7, 8.4, 9.8][(i + 1) % 3];
      house(b, 92 + i * 8, -31 - (i % 3) * 9 - r() * 3, 0, w, 8, h, 7, 0);
    }
    // hills around the horizon
    const hill = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const hm = [lam("fl_hillA", () => ({ color: "#7fae63" })), lam("fl_hillB", () => ({ color: "#6f9f55" })), lam("fl_hillC", () => ({ color: "#8cbb6d" }))];
    ([[-330, 190, 220, 46, 150], [300, 150, 200, 52, 140], [-430, -70, 190, 40, 160], [420, -110, 210, 44, 150],
      [-180, 380, 260, 58, 180], [150, -420, 250, 54, 170]] as const).forEach(([x, z, sx, sy, sz], i) =>
      b.add(hill, hm[i % 3], new THREE.Matrix4().compose(V(x, -2, z), new THREE.Quaternion(), V(sx, sy, sz))));
    // trees and lamps: along the verge behind the fences, and in the fields either side
    const trees = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree-high-round", "tree"];
    const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length) % a.length];
    for (let x = -160; x <= 160; x += 17) {
      if (Math.abs(x - 111) > 26) prop(b, kit, pick(trees), x + r() * 5, 0, 9.6 + r() * 3.4, 7 + r() * 3, r() * 6);
      if (Math.abs(x - 111) > 30 && r() < 0.6) prop(b, kit, pick(trees), x + r() * 5, 0, -10.5 - r() * 4, 6 + r() * 3, r() * 6);
      if (r() < 0.35) prop(b, kit, pick(["plant_bushLarge", "plant_bushDetailed", "plant_bush"]), x + 3 + r() * 4, 0, 7.4 + r() * 2, 1.4);
    }
    for (let i = 0; i < 60; i++) {
      const x = (r() - 0.5) * 620, z = (r() < 0.5 ? -1 : 1) * (34 + r() * 210);
      if (Math.abs(x - 111) < 34 || (x > 84 && x < 146 && z < -20)) continue;
      prop(b, kit, pick(trees), x, 0, z, 7 + r() * 4, r() * 6);
    }
    for (const x of [-124, -58, 12, 74]) prop(b, kit, "lantern", x, 0, 6.2, 2.9);
    b.build(R);

    // ---- dynamic: the two cars and the tape ----
    this.car = carGroup(false); this.carR = carGroup(true);
    this.car.g.position.set(carX(0), 0, CAR_Z); this.carR.g.position.set(70, 0, 1.5);
    this.carR.g.rotation.y = -0.12;
    R.add(this.car.g, this.carR.g);
    const tapeMat = lam("fl_tape", () => ({ color: "#d8b23a" }));
    for (let i = 0; i < 2; i++) { const s = new Strand(14, 0.035, 0.06, tapeMat, 1); this.tape.push(s); R.add(s.mesh); }
  }

  /** camera-relative sun, frozen per shot: the shot's mean view direction turned by az toward screen right, lifted by el */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(L.az), el = THREE.MathUtils.degToRad(L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az); // screen right = (-fz, fx)
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK); // sky, clouds, sun sprites and cards live on the no-ink layer but are still rendered
    // ---- light rig (lighting.md 9.4): camera-relative sun frozen per shot, two-tone uniforms, shadow fit ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    if (s.light === "golden") Rr = Math.max(Rr, 30); // el 7: 2 m cards throw ~16 m shadows, houses much longer
    // texel-snap the shadow focus to the shadow map's grid (light space), so the shadow edges do not shimmer as the lens glides
    const lr = new THREE.Vector3().crossVectors(sunDir, V(0, 1, 0));
    if (lr.lengthSq() < 1e-6) lr.set(1, 0, 0);
    lr.normalize();
    const lu = new THREE.Vector3().crossVectors(lr, sunDir).normalize();
    const texel = (2 * Rr) / 2048;
    const sx = Math.round(focus.dot(lr) / texel) * texel, sy = Math.round(focus.dot(lu) / texel) * texel;
    const spot = focus.clone().addScaledVector(lr, sx - focus.dot(lr)).addScaledVector(lu, sy - focus.dot(lu));
    this.sun.position.copy(spot).addScaledVector(sunDir, 220); this.sun.target.position.copy(spot);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, sun disc + halo, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    const bmap = this.bannerMaps[s.light];
    const bmat = this.banner.material as THREE.MeshBasicMaterial;
    if (bmat.map !== bmap) { bmat.map = bmap; bmat.needsUpdate = true; }
    // ---- the finish tape: two slack halves from the posts to whatever is left of the tape ----
    const br = tapeBroken(f), e0 = tapeEnd(f, -1), e1 = tapeEnd(f, 1);
    const half = (sign: number, end: [number, number]) => Array.from({ length: 14 }, (_, i) => {
      const u = i / 13;
      return V(TAPE_X, TAPE_H + (end[0] - TAPE_H) * u - (br ? 0.15 : 0.02) * Math.sin(Math.PI * u), sign * 2.9 * (1 - u) + end[1] * u);
    });
    this.tape[0].set(half(-1, e0)); this.tape[1].set(half(1, e1));
    // ---- the car: driving (shots 1-8) or abandoned (shots 9-10) ----
    const driving = f < 781;
    this.car.g.visible = driving; this.carR.g.visible = !driving;
    if (driving) {
      const hz = engineHz(t), sp = carSpeed(t);
      this.car.g.position.set(carX(t), 0, CAR_Z);
      const acc = (carSpeed(t + 0.04) - sp) / 0.04;
      this.car.g.rotation.z = THREE.MathUtils.clamp(0.0012 * acc, -0.03, 0.03); // squat under power, nose-dive on the brakes
      this.car.g.rotation.x = 0.0004 * sp;
      this.car.body.rotation.z = hz > 0 ? 0.004 * Math.sin(t * 43) : 0;   // the engine rocks the body
      this.car.body.position.y = hz > 0 ? 0.006 * Math.sin(t * 57) : 0;
      const spin = -carX(t) / 0.42;
      for (const w of this.car.wheels) w.rotation.z = spin;
    }
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, { pos: cam.position, right, sun: sunDir });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const tint = s.light === "golden" ? "#ffcf9e" : "#ffffff";
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      if (a.mat.emissiveMap) a.mat.emissive.set(tint);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const fx2 = this.fx(fi++);
      fx2.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      fx2.use(!!p.soft);
      fx2.mesh.visible = true;
      fx2.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) fx2.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { fx2.mesh.quaternion.copy(cam.quaternion); fx2.mesh.rotateZ(p.rot ?? 0); }
      fx2.mesh.scale.set(p.w, p.h, 1);
      fused.push(fx2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e2 of fused) e2.bind();
    return V(...focusAt(id, f));
  }
}
