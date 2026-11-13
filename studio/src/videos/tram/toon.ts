// toon.ts — the Canvas2D drawing API the characters are drawn with, and the billboard that carries them.
// One owner: this file. Design space: a 512x1024 canvas at 500 px per metre, the soles at y = 980, so the card
// is 1.024 m wide by 2.048 m tall in world units and every character is drawn to scale inside it.
//
// The look (SKILL.md): flat bean-head cartoon cards with a plum variable-width ink outline, no gradients except
// the ones deliberately painted, and NO world ink line on the card (the character carries its own ink, and the
// card is put on the NOINK layer). Night rule for this film: the light comes from the tram, so every card is
// drawn with a warm rim on the tram side and a cool shade body — a backlit silhouette that still reads.
import * as THREE from "three";
import { mulberry32 } from "./contract";

export const INK = "#241726";
export const PX_PER_M = 500;
export const CARD_W = 512;
export const CARD_H = 1024;
export const GROUND_Y = 980;                     // soles
export const CARD_H_M = CARD_H / PX_PER_M;       // 2.048 m
export const CARD_W_M = CARD_W / PX_PER_M;       // 1.024 m
/** world y of the card's centre so the drawing's soles land exactly on y = 0 */
export const CARD_CENTRE_Y = (GROUND_Y - CARD_H / 2) / PX_PER_M; // 0.936 m

export type Pt = [number, number];
export type RGB = [number, number, number];
/** mix two hex-ish rgb triples */
export const mix = (a: RGB, b: RGB, t: number): string =>
  `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
export const rgb = (c: RGB) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

export class Pen {
  c: CanvasRenderingContext2D;
  constructor(c: CanvasRenderingContext2D) {
    this.c = c;
    c.lineJoin = "round";
    c.lineCap = "round";
  }
  private trace(pts: Pt[]) {
    const c = this.c;
    c.beginPath();
    for (let i = 0; i < pts.length; i++) (i ? c.lineTo : c.moveTo).call(c, pts[i][0], pts[i][1]);
    c.closePath();
  }
  /** Filled polygon with a plum ink outline (stroke first at 2x width, then fill covers the inner half). */
  shape(pts: Pt[], fill?: string, inkW = 3.4) {
    const c = this.c;
    this.trace(pts);
    if (inkW > 0) { c.strokeStyle = INK; c.lineWidth = inkW * 2; c.stroke(); }
    if (fill) { c.fillStyle = fill; c.fill(); }
  }
  /** A translucent shape CLIPPED to the previous path — how the shading and the rim are laid in. */
  inside(pts: Pt[], fill: string) {
    const c = this.c;
    c.save(); this.trace(pts); c.clip();
    c.beginPath();
    for (let i = 0; i < pts.length; i++) (i ? c.lineTo : c.moveTo).call(c, pts[i][0], pts[i][1]);
    c.closePath(); c.fillStyle = fill; c.fill(); c.restore();
  }
  /** ellipse, optionally rotated (deg); RETURNS the polygon it drew so it can be re-used for a rim or a shade */
  ell(x: number, y: number, rx: number, ry: number, rot: number, fill?: string, inkW = 3.4): Pt[] {
    const c = this.c; c.save(); c.translate(x, y); c.rotate((rot * Math.PI) / 180);
    const a = Math.abs(rx), b = Math.abs(ry);
    const pts: Pt[] = [];
    for (let i = 0; i < 32; i++) { const t = (i / 32) * Math.PI * 2; pts.push([x + a * Math.cos(t) * Math.cos((rot * Math.PI) / 180) - b * Math.sin(t) * Math.sin((rot * Math.PI) / 180), y + a * Math.cos(t) * Math.sin((rot * Math.PI) / 180) + b * Math.sin(t) * Math.cos((rot * Math.PI) / 180)]); }
    c.beginPath(); c.ellipse(0, 0, a, b, 0, 0, Math.PI * 2);
    if (inkW > 0) { c.strokeStyle = INK; c.lineWidth = inkW * 2; c.stroke(); }
    if (fill) { c.fillStyle = fill; c.fill(); }
    c.restore();
    return pts;
  }
  /** variable-width limb: a tapering capsule from (x1,y1,w1) to (x2,y2,w2) with round caps */
  taper(x1: number, y1: number, w1: number, x2: number, y2: number, w2: number, fill?: string, inkW = 3.2) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const a0 = Math.atan2(ny, nx);
    const pts: Pt[] = [];
    for (let k = 0; k <= 6; k++) { const a = a0 - (Math.PI * k) / 6; pts.push([x2 + w2 * Math.cos(a), y2 + w2 * Math.sin(a)]); }
    for (let k = 0; k <= 6; k++) { const a = a0 + Math.PI + (Math.PI * k) / 6; pts.push([x1 + w1 * Math.cos(a), y1 + w1 * Math.sin(a)]); }
    this.shape(pts, fill, inkW);
    void ux; void uy;
    return pts;
  }
  /** straight bar with round ends */
  bar(x1: number, y1: number, x2: number, y2: number, w: number, fill?: string, inkW = 3.0) {
    return this.taper(x1, y1, w, x2, y2, w, fill, inkW);
  }
  /** inner rim on the light side: a translucent warm edge, then a dark shade on the other side. Both are clipped
   *  to the shape, so the rim can never leak outside the silhouette (SKILL: inner rim only, never an offset copy). */
  lit(pts: Pt[], rim: string, rimW: number, ox: number, oy: number, shade?: string, sx = 0, sy = 0) {
    const c = this.c;
    c.save();
    this.trace(pts); c.clip();
    if (shade) { c.translate(sx, sy); this.trace(pts); c.fillStyle = shade; c.fill(); c.translate(-sx, -sy); }
    c.translate(ox, oy); this.trace(pts); c.strokeStyle = rim; c.lineWidth = rimW * 2; c.stroke();
    c.restore();
  }
  /** soft radial bloom painted into the card (the lamp behind the character) */
  bloom(x: number, y: number, r: number, colour: string, a: number) {
    const c = this.c;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, colour.replace("rgb(", "rgba(").replace(")", `,${a})`));
    g.addColorStop(1, colour.replace("rgb(", "rgba(").replace(")", ",0)"));
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// ---------------------------------------------------------------- the billboard
export type Card = { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; tex: THREE.CanvasTexture; dispose: () => void };

/** Build one camera-facing character card. alphaTest makes the cut-out real, and the customDepthMaterial makes
 *  the cut-out real in the depth pass too (so the ink pass and the shadows agree with the silhouette).
 *  noInkFallback() (ink.ts) sees the customDepthMaterial and moves the card to the NOINK layer. */
const TEXC = new Map<string, THREE.CanvasTexture>();
export function makeCard(draw: (p: Pen, rnd: () => number) => void, seed = 1, key?: string): Card {
  let tex = key ? TEXC.get(key) : undefined;
  if (!tex) {
    const cv = document.createElement("canvas");
    cv.width = CARD_W; cv.height = CARD_H;
    const c = cv.getContext("2d") as CanvasRenderingContext2D;
    draw(new Pen(c), mulberry32(seed));
    tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    if (key) TEXC.set(key, tex);
  }
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.45, side: THREE.DoubleSide, depthWrite: true, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W_M, CARD_H_M), mat);
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.45 });
  mesh.frustumCulled = false;
  return {
    mesh, mat, tex,
    dispose: () => { tex.dispose(); mat.dispose(); mesh.geometry.dispose(); },
  };
}
