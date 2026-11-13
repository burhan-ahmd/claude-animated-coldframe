// tram.ts — the tram itself: car 7 of the depot, on the last run of the night. Owned by this file.
// Local frame: the body runs along Z, the front (leading) end is +Z, the +X side faces the camera's pavement.
// Frames 0-96 the +Z end leads with the white headlamp lit; from 300 the driver has changed ends, so the -Z end
// leads and the +Z end now shows its red tail lamp (contract.tramZ / leadingEnd). Everything is built once and
// only posed per frame.
import * as THREE from "three";
import { TRAM, STREET, GLOW, tramZ, tramBob, tramSway, tramWheelAngle, FPS, clamp, lerp, sat } from "./contract";
import { tramLower, tramUpper, tramWindows, tramEnd, tramRoof, radial } from "./wet";
import { twoTone } from "../bridge/shade";
import { NOINK } from "../bridge/ink";

const HW = TRAM.w / 2, HL = TRAM.len / 2, HX = TRAM.bodySide;
const FLOOR = TRAM.floorY, WAIST = TRAM.winY, WTOP = TRAM.winY + TRAM.winH, EAVE = TRAM.roofY, VAULT = TRAM.vaultY;

/** A flat panel facing +X (s=1) or -X (s=-1), or +Z (axis "z"). */
function panel(w: number, h: number, axis: "x" | "z", s: number, map: THREE.Texture, mat?: THREE.Material): THREE.Mesh {
  const g = new THREE.PlaneGeometry(w, h);
  const m = new THREE.Mesh(g, mat ?? new THREE.MeshBasicMaterial({ map, fog: true }));
  if (axis === "x") { m.rotation.y = s * Math.PI / 2; m.position.x = s * (HX + 0.004); }
  else { m.rotation.y = s > 0 ? 0 : Math.PI; m.position.z = s * (HL + 0.004); }
  return m;
}
/** A lit band (the saloon and the route box are unlit and pushed above 1 so the bloom picks them up). */
function glowMat(map: THREE.Texture, k: number) {
  return new THREE.MeshBasicMaterial({ map, color: new THREE.Color("#ffffff").multiplyScalar(k), fog: true, toneMapped: false });
}

export class Tram {
  root = new THREE.Group();
  private body = new THREE.Group();
  private wheels: THREE.Mesh[] = [];
  private headLens: THREE.MeshBasicMaterial;
  private headHalo: THREE.Sprite;
  private beam: THREE.Mesh;
  private tailLens: THREE.MeshBasicMaterial;
  private tailHalo: THREE.Sprite;
  private spill: THREE.MeshBasicMaterial[] = [];
  private pole: THREE.Group;

  constructor() {
    const R = this.root, B = this.body;
    R.add(B);
    const lower = twoTone(new THREE.MeshLambertMaterial({ map: tramLower(), color: "#cdd4d0" }), 0.5);
    const upper = twoTone(new THREE.MeshLambertMaterial({ map: tramUpper(), color: "#cdd4d0" }), 0.5);
    const roofT = twoTone(new THREE.MeshLambertMaterial({ map: tramRoof(), color: "#c8ccc8" }), 0.5);
    const dark = twoTone(new THREE.MeshPhongMaterial({ color: "#1b1f24", specular: "#5a6472", shininess: 30 }), 0.5);
    const green = twoTone(new THREE.MeshPhongMaterial({ color: "#1e3a34", specular: "#7f8f86", shininess: 45 }), 0.5);
    const endMat = new THREE.MeshBasicMaterial({ map: tramEnd(), color: new THREE.Color("#ffffff").multiplyScalar(1.15), fog: true, toneMapped: false });

    // ---- the sides
    for (const s of [-1, 1] as const) {
      const lo = panel(TRAM.len, WAIST - 0.30, "x", s, tramLower(), lower); lo.position.y = (WAIST + 0.30) / 2;
      B.add(lo);
      const wb = panel(TRAM.len, WTOP - WAIST, "x", s, tramWindows(), glowMat(tramWindows(), 1.6)); wb.position.y = (WAIST + WTOP) / 2;
      B.add(wb);
      const up = panel(TRAM.len, EAVE - WTOP, "x", s, tramUpper(), upper); up.position.y = (WTOP + EAVE) / 2;
      B.add(up);
      for (const z of [-1.6, 1.6]) {                       // doorways
        const d = new THREE.Mesh(new THREE.PlaneGeometry(0.90, 1.45), new THREE.MeshBasicMaterial({ color: "#120e0b", fog: true }));
        d.rotation.y = s * Math.PI / 2; d.position.set(s * (HX + 0.008), FLOOR + 0.725, z); B.add(d);
        const g = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.34), new THREE.MeshBasicMaterial({ color: new THREE.Color(GLOW.tramInterior, 0.9, 0.72).multiplyScalar(0.28), fog: true, transparent: true, opacity: 0.85 }));
        g.rotation.y = s * Math.PI / 2; g.position.set(s * (HX + 0.010), FLOOR + 1.32, z); B.add(g);
        const step = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.96), dark);
        step.position.set(s * (HX + 0.14), FLOOR - 0.05, z); B.add(step);
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.72, 8), dark);
        rail.position.set(s * (HX + 0.16), FLOOR + 1.15, z + 0.44); B.add(rail);
      }
    }
    // ---- the ends (the painted panel carries the motorman, the route box and the lifeguard)
    const ePH = 2.48, eCY = 0.05 + ePH / 2;
    for (const s of [1, -1] as const) {
      const e = panel(TRAM.w, ePH, "z", s, tramEnd(), endMat); e.position.y = eCY; B.add(e);
      const shade = new THREE.Mesh(new THREE.BoxGeometry(TRAM.w, 0.16, 0.10), dark);
      shade.position.set(0, EAVE + 0.06, s * (HL + 0.03)); B.add(shade);
      const lg = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.10, 0.30), dark);
      lg.position.set(0, 0.20, s * (HL + 0.10)); B.add(lg);
    }
    // ---- roof: a slab, then the clerestory vault
    const slab = new THREE.Mesh(new THREE.BoxGeometry(TRAM.w + 0.06, EAVE - (EAVE - 0.16) + 0.16, TRAM.len + 0.06), roofT);
    slab.position.y = EAVE + 0.08; B.add(slab);
    const vault = new THREE.Mesh(new THREE.BoxGeometry(1.86, VAULT - (EAVE + 0.16), TRAM.len - 0.4), roofT);
    vault.position.y = (EAVE + 0.16 + VAULT) / 2; B.add(vault);
    const under = new THREE.Mesh(new THREE.BoxGeometry(TRAM.w - 0.2, 0.34, TRAM.len - 0.5), dark);
    under.position.y = 0.46; B.add(under);
    // ---- running gear
    const wheelG = new THREE.CylinderGeometry(0.315, 0.315, 0.10, 18); wheelG.rotateZ(Math.PI / 2);
    const wheelM = twoTone(new THREE.MeshPhongMaterial({ color: "#22262c", specular: "#77808c", shininess: 70 }), 0.5);
    for (const z of [-2.45, 2.45]) for (const s of [-1, 1] as const) {
      const w = new THREE.Mesh(wheelG, wheelM); w.position.set(s * STREET.railX, 0.315, z); B.add(w); this.wheels.push(w);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.20, 16), twoTone(new THREE.MeshPhongMaterial({ color: "#3a3f47", specular: "#9aa4b0", shininess: 90 }), 0.5));
      face.rotation.y = s * Math.PI / 2; face.position.set(s * (STREET.railX + 0.052), 0.315, z); B.add(face);
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.36, 0.05), dark);
      sp.position.set(s * (STREET.railX + 0.058), 0.315, z); B.add(sp);
    }
    // ---- trolley pole and its wheel (trails backwards; it flips when the driver changes ends)
    this.pole = new THREE.Group(); B.add(this.pole);
    const pg = new THREE.CylinderGeometry(0.028, 0.038, 2.9, 8); pg.translate(0, 1.45, 0);
    const pm = new THREE.Mesh(pg, twoTone(new THREE.MeshPhongMaterial({ color: "#4a4034", specular: "#a08f70", shininess: 40 }), 0.5));
    pg.rotateX(0.30); this.pole.add(pm);
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 12), pm.material);
    tw.rotation.z = Math.PI / 2; tw.position.set(0, 2.86, -0.86); this.pole.add(tw);
    this.pole.position.y = VAULT - 0.02;

    // ---- headlamp (+Z end): housing, HDR lens, halo, and a cone of light through the rain
    const case_ = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.16, 14), dark);
    case_.rotation.x = Math.PI / 2; case_.position.set(0, 1.36, HL + 0.06); B.add(case_);
    this.headLens = new THREE.MeshBasicMaterial({ color: new THREE.Color(GLOW.headlampLens).multiplyScalar(GLOW.headlamp), fog: true, toneMapped: false });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.145, 20), this.headLens);
    lens.position.set(0, 1.36, HL + 0.145); B.add(lens);
    const halo = new THREE.SpriteMaterial({ map: radial(101, 2.4, 1), color: new THREE.Color(GLOW.lampLens), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.headHalo = new THREE.Sprite(halo); this.headHalo.scale.setScalar(2.6); this.headHalo.position.set(0, 1.36, HL + 0.16);
    this.headHalo.layers.set(NOINK); B.add(this.headHalo);
    const bg = new THREE.ConeGeometry(1.35, 7.5, 20, 1, true); bg.rotateX(-Math.PI / 2); bg.translate(0, 0, 3.75);
    this.beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffe7c2"), transparent: true, opacity: 0.055, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.beam.position.set(0, 1.36, HL + 0.14); this.beam.layers.set(NOINK); B.add(this.beam);

    // ---- tail lamp (the same +Z end, red once the driver has changed ends at f = 300)
    this.tailLens = new THREE.MeshBasicMaterial({ color: new THREE.Color(GLOW.taillightCol).multiplyScalar(0.12), fog: true, toneMapped: false });
    const tl = new THREE.Mesh(new THREE.CircleGeometry(0.10, 16), this.tailLens);
    tl.position.set(0.78, 1.02, HL + 0.02); B.add(tl);
    const tls = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial(103, 2.6, 1), color: new THREE.Color(GLOW.taillightCol), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.tailHalo = tls; this.tailHalo.scale.setScalar(1.5); this.tailHalo.position.set(0.78, 1.02, HL + 0.06); this.tailHalo.layers.set(NOINK); B.add(this.tailHalo);

    // ---- the saloon light falling on the wet street either side (additive, so it reads on the water)
    for (const s of [-1, 1] as const) {
      const g = new THREE.PlaneGeometry(2.4, TRAM.len + 1.4); g.rotateX(-Math.PI / 2);
      const m = new THREE.MeshBasicMaterial({ map: radial(105, 2.2, 0.9), color: new THREE.Color(GLOW.lampWarm), transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const q = new THREE.Mesh(g, m); q.position.set(s * 2.05, STREET.waterY + 0.010, 0); q.renderOrder = 4; B.add(q);
      this.spill.push(m);
    }
    B.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !(m.material as THREE.Material).transparent) m.castShadow = true; });
  }

  /** Pose the car for frame f. */
  update(f: number) {
    const R = this.root, B = this.body;
    R.position.set(0, tramBob(f), tramZ(f));
    B.rotation.z = (tramSway(f) * Math.PI) / 180;
    B.rotation.x = 0.004 * Math.sin(f * 0.7);
    for (const w of this.wheels) w.rotation.x = -tramWheelAngle(f);
    // the pole trails behind the direction of travel
    const back = f <= 300 ? 1 : -1;
    this.pole.rotation.y = back > 0 ? 0 : Math.PI;
    // lamps: the headlamp is the arrival, the tail lamp only exists after the driver changes ends
    const arrive = 1 - sat((f - 96) / 40);
    const tail = sat((f - 300) / 10);
    this.headLens.color.copy(new THREE.Color(GLOW.headlampLens).multiplyScalar(GLOW.headlamp * (0.22 + 0.78 * arrive)));
    (this.headHalo.material as THREE.SpriteMaterial).opacity = 0.14 + 0.55 * arrive;
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.012 + 0.055 * arrive;
    (this.headHalo.material as THREE.SpriteMaterial).color.set(GLOW.lampLens);
    this.tailLens.color.copy(new THREE.Color(GLOW.taillightCol).multiplyScalar(0.12 + GLOW.taillight * tail));
    (this.tailHalo.material as THREE.SpriteMaterial).opacity = 0.55 * tail;
    // the saloon flicker and the spill on the water
    const flick = 0.94 + 0.05 * Math.sin(f * 1.9) + 0.03 * Math.sin(f * 0.61 + 1.3);
    for (const m of this.spill) m.opacity = 0.11 * flick * (f > 96 && f < 320 ? 1.35 : 1);
  }
}
